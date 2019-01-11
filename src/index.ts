import {
  Index, DocumentDetails, FieldDetails, InvertedIndexNode, createInvertedIndexNode,
  addInvertedIndexChildNode, findInvertedIndexChildNodeByCharCode, addInvertedIndexPosting,
} from "ndx";

/**
 * Serializable Document ID.
 */
export type SerializableDocumentId = string | number;

/**
 * Index data structure optimized for serialization.
 *
 * - `documents` Map is converted into two separate arrays: `docIds` and `docFieldLengths` to optimize for use cases
 * when document IDs are using number values. See [Element kinds in V8](https://v8.dev/blog/elements-kinds) for more
 * details.
 * - Inverted index trie is flattened and converted into two separate arrays: `terms` and `postings` to make sure that
 * gzip could compress common prefixes for terms.
 * - Frequenlty used objects are converted into arrays to reduce work for serializers/deserializers that encode propery
 * names.
 *
 * @typeparam I Document ID type.
 */
export interface SerializableIndex<I extends SerializableDocumentId> {
  /**
   * Document ids.
   */
  docIds: I[];
  /**
   * Document field lengths.
   */
  docFieldLengths: number[][];
  /**
   * Inverted index terms.
   */
  terms: string[];
  /**
   * Inverted index postings.
   */
  postings: SerializableDocumentPointer<I>[][];
  /**
   * Additional information about indexed fields in all documents.
   */
  fields: FieldDetails[];
}

/**
 * Document pointer contains document ID and term frequency.
 *
 * @typeparam I Document ID type.
 */
export type SerializableDocumentPointer<I extends SerializableDocumentId> = [I, number[]];

/**
 * Converts {@link Index} to {@link SerializableIndex}.
 *
 * @param index {@link Index}.
 * @returns {@link SerializableIndex}.
 */
export function toSerializable<I extends SerializableDocumentId>(index: Index<I>): SerializableIndex<I> {
  const docIds: I[] = [];
  const docFieldLengths: number[][] = [];
  index.documents.forEach((d) => {
    docIds.push(d.id);
    docFieldLengths.push(d.fieldLengths);
  });

  const terms: string[] = [];
  const postings: SerializableDocumentPointer<I>[][] = [];

  // ignore root node
  let child = index.root.firstChild;
  if (child !== null) {
    const term: number[] = [];
    do {
      flattenInvertedIndex(child, term, terms, postings);
      child = child.next;
    } while (child !== null);
    terms.reverse();
    postings.reverse();
  }

  return {
    docIds,
    docFieldLengths,
    terms,
    postings,
    fields: index.fields,
  };
}

function flattenInvertedIndex<I extends SerializableDocumentId>(
  node: InvertedIndexNode<I>,
  term: number[],
  terms: string[],
  postings: SerializableDocumentPointer<I>[][],
): void {
  term = term.slice();
  term.push(node.charCode);

  let posting = node.firstPosting;
  if (posting !== null) {
    terms.push(String.fromCharCode.apply(void 0, term));
    const p: SerializableDocumentPointer<I>[] = [];
    do {
      p.push([posting.details.id, posting.termFrequency]);
      posting = posting.next;
    } while (posting !== null);
    p.reverse();
    postings.push(p);
  }

  let child = node.firstChild;
  if (child !== null) {
    do {
      flattenInvertedIndex(child, term, terms, postings);
      child = child.next;
    } while (child !== null);
  }
}

/**
 * Converts {@link SerializableIndex} to {@link Index}.
 *
 * @param index {@link SerializableIndex}.
 * @returns {@link Index}.
 */
export function fromSerializable<I extends SerializableDocumentId>(index: SerializableIndex<I>): Index<I> {
  const documents = new Map<I, DocumentDetails<I>>();
  const { docIds, docFieldLengths, terms, postings, fields } = index;
  for (let i = 0; i < docIds.length; i++) {
    const id = docIds[i];
    documents.set(id, { id, fieldLengths: docFieldLengths[i] });
  }

  const root = createInvertedIndexNode<I>(0);

  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const ps = postings[i];

    let node = root;

    for (let j = 0; j < term.length; j++) {
      if (node.firstChild === null) {
        node = createInvertedIndexNodes(node, term, j);
        break;
      }
      const nextNode = findInvertedIndexChildNodeByCharCode(node, term.charCodeAt(j));
      if (nextNode === void 0) {
        node = createInvertedIndexNodes(node, term, j);
        break;
      }
      node = nextNode;
    }

    for (let j = 0; j < ps.length; j++) {
      const p = ps[j];
      addInvertedIndexPosting(
        node,
        {
          next: null,
          details: documents.get(p[0])!,
          termFrequency: p[1],
        },
      );
    }
  }

  return { documents, root, fields };
}

/**
 * Creates inverted index nodes for the `term` starting from the `start` character.
 *
 * @typeparam I Document ID type.
 * @param parent Parent node.
 * @param term Term.
 * @param start First char code position in the `term`.
 * @returns Leaf {@link InvertedIndexNode}.
 */
function createInvertedIndexNodes<I>(
  parent: InvertedIndexNode<I>,
  term: string,
  start: number,
): InvertedIndexNode<I> {
  for (; start < term.length; start++) {
    const newNode = createInvertedIndexNode<I>(term.charCodeAt(start));
    addInvertedIndexChildNode(parent, newNode);
    parent = newNode;
  }
  return parent;
}
