import {
  Index, DocumentDetails, FieldDetails, InvertedIndexNode, createInvertedIndexNode,
  addInvertedIndexChildNode, findInvertedIndexChildNodeByCharCode, addInvertedIndexDoc,
} from "ndx";

/**
 * Serializable Document Key.
 */
export type SerializableDocumentKey = string | number;

/**
 * Index data structure optimized for serialization.
 *
 * - `documents` Map is converted into two separate arrays: `docKeys` and `docFieldLengths` to optimize for use cases
 * when document keys are using number values. See [Element kinds in V8](https://v8.dev/blog/elements-kinds) for more
 * details.
 * - Inverted index trie is flattened and converted into two separate arrays: `terms` and `postings` to make sure that
 * gzip could compress common prefixes for terms.
 * - Frequenlty used objects are converted into arrays to reduce work for serializers/deserializers that encode propery
 * names.
 *
 * @typeparam T Serializable document key type.
 */
export interface SerializableIndex<T extends SerializableDocumentKey> {
  /**
   * Document keys.
   */
  docKeys: T[];
  /**
   * Document field lengths.
   */
  docFieldLengths: number[][];
  /**
   * Inverted index terms.
   */
  terms: string[];
  /**
   * Inverted index document pointers.
   */
  docs: SerializableDocumentPointer<T>[][];
  /**
   * Additional information about indexed fields in all documents.
   */
  fields: FieldDetails[];
}

/**
 * Document pointer contains document key and term frequency.
 *
 * @typeparam T Serializable document key type.
 */
export type SerializableDocumentPointer<T extends SerializableDocumentKey> = [T, number[]];

/**
 * Converts {@link Index} to {@link SerializableIndex}.
 *
 * @typeparam T Serializable document key type.
 * @param index {@link Index}.
 * @returns {@link SerializableIndex}.
 */
export function toSerializable<T extends SerializableDocumentKey>(index: Index<T>): SerializableIndex<T> {
  const docKeys: T[] = [];
  const docFieldLengths: number[][] = [];
  index.docs.forEach((d) => {
    docKeys.push(d.key);
    docFieldLengths.push(d.fieldLengths);
  });

  const terms: string[] = [];
  const postings: SerializableDocumentPointer<T>[][] = [];

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
    docKeys,
    docFieldLengths,
    terms,
    docs: postings,
    fields: index.fields,
  };
}

function flattenInvertedIndex<T extends SerializableDocumentKey>(
  node: InvertedIndexNode<T>,
  term: number[],
  terms: string[],
  postings: SerializableDocumentPointer<T>[][],
): void {
  term = term.slice();
  term.push(node.charCode);

  let doc = node.firstDoc;
  if (doc !== null) {
    terms.push(String.fromCharCode.apply(void 0, term));
    const p: SerializableDocumentPointer<T>[] = [];
    do {
      p.push([doc.details.key, doc.termFrequency]);
      doc = doc.next;
    } while (doc !== null);
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
 * @typeparam T Serializable document key type.
 * @param index {@link SerializableIndex}.
 * @returns {@link Index}.
 */
export function fromSerializable<I extends SerializableDocumentKey>(index: SerializableIndex<I>): Index<I> {
  const docs = new Map<I, DocumentDetails<I>>();
  const { docKeys, docFieldLengths, terms, docs: postings, fields } = index;
  for (let i = 0; i < docKeys.length; i++) {
    const key = docKeys[i];
    docs.set(key, { key, fieldLengths: docFieldLengths[i] });
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
      addInvertedIndexDoc(
        node,
        {
          next: null,
          details: docs.get(p[0])!,
          termFrequency: p[1],
        },
      );
    }
  }

  return { docs, root, fields };
}

/**
 * Creates inverted index nodes for the `term` starting from the `start` character.
 *
 * @typeparam T Serializable document key type.
 * @param parent Parent node.
 * @param term Term.
 * @param start First char code position in the `term`.
 * @returns Leaf {@link InvertedIndexNode}.
 */
function createInvertedIndexNodes<T>(
  parent: InvertedIndexNode<T>,
  term: string,
  start: number,
): InvertedIndexNode<T> {
  for (; start < term.length; start++) {
    const newNode = createInvertedIndexNode<T>(term.charCodeAt(start));
    addInvertedIndexChildNode(parent, newNode);
    parent = newNode;
  }
  return parent;
}
