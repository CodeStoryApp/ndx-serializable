import { Index, DocumentDetails, FieldDetails, InvertedIndexNode, DocumentPointer } from "ndx";

/**
 * Serializable Document ID.
 */
export type SerializableDocumentId = string | number;

/**
 * Index data structure optimized for serialization.
 *
 * @typeparam I Document ID type.
 */
export interface SerializableIndex<I extends SerializableDocumentId> {
  /**
   * Additional information about documents.
   */
  documents: DocumentDetails<I>[];
  /**
   * Inverted index root node.
   */
  root: SerializableInvertedIndexNode<I>;
  /**
   * Additional information about indexed fields in all documents.
   */
  fields: FieldDetails[];
}

/**
 * Document pointer contains information about term frequency for a document.
 *
 * @typeparam I Document ID type.
 */
export interface SerializableDocumentPointer<I extends SerializableDocumentId> {
  /**
   * Document ID.
   */
  id: I;
  /**
   * Term frequency in each field.
   */
  termFrequency: number[];
}

/**
 * Inverted Index Node.
 *
 * Inverted index is implemented with a [trie](https://en.wikipedia.org/wiki/Trie) data structure.
 *
 * @typeparam I Document ID type.
 */
export interface SerializableInvertedIndexNode<I extends SerializableDocumentId> {
  /**
   * Char code is used to store keys in the trie data structure.
   */
  charCode: number;
  /**
   * Children nodes.
   */
  children?: SerializableInvertedIndexNode<I>[];
  /**
   * Documents associated with this node.
   */
  postings?: SerializableDocumentPointer<I>[];
}

/**
 * Converts {@link Index} to {@link SerializableIndex}.
 *
 * @param index {@link Index}.
 * @returns {@link SerializableIndex}.
 */
export function toSerializable<I extends SerializableDocumentId>(index: Index<I>): SerializableIndex<I> {
  return {
    documents: Array.from(index.documents.values()),
    root: toSerializableInvertedIndexNode(index.root),
    fields: index.fields,
  };
}

function toSerializableInvertedIndexNode<I extends SerializableDocumentId>(
  node: InvertedIndexNode<I>,
): SerializableInvertedIndexNode<I> {
  const r: SerializableInvertedIndexNode<I> = { charCode: node.charCode };
  let child = node.firstChild;
  if (child !== null) {
    const children: SerializableInvertedIndexNode<I>[] = r.children = [];
    do {
      children.push(toSerializableInvertedIndexNode(child));
      child = child.next;
    } while (child !== null);
  }

  let posting = node.firstPosting;
  if (posting !== null) {
    const postings: SerializableDocumentPointer<I>[] = r.postings = [];
    do {
      postings.push(toSerializableDocumentPointer(posting));
      posting = posting.next;
    } while (posting !== null);
  }

  return r;
}

function toSerializableDocumentPointer<I extends SerializableDocumentId>(
  posting: DocumentPointer<I>,
): SerializableDocumentPointer<I> {
  return {
    id: posting.details.id,
    termFrequency: posting.termFrequency,
  };
}

/**
 * Converts {@link SerializableIndex} to {@link Index}.
 *
 * @param index {@link SerializableIndex}.
 * @returns {@link Index}.
 */
export function fromSerializable<I extends SerializableDocumentId>(index: SerializableIndex<I>): Index<I> {
  const documents = new Map<I, DocumentDetails<I>>();
  const serializedDocuments = index.documents;
  for (let i = 0; i < serializedDocuments.length; i++) {
    const d = serializedDocuments[i];
    documents.set(d.id, d);
  }
  return {
    documents,
    root: fromSerializableInvertedIndexNode(index.root, documents),
    fields: index.fields,
  };
}

function fromSerializableInvertedIndexNode<I extends SerializableDocumentId>(
  node: SerializableInvertedIndexNode<I>,
  documents: Map<I, DocumentDetails<I>>,
): InvertedIndexNode<I> {
  const { charCode, children, postings } = node;
  return {
    charCode,
    next: null,
    firstChild: fromSerializableInvertedIndexChildrenArray(children, documents),
    firstPosting: fromSerializableDocumentPointerArray(postings, documents),
  };
}

function fromSerializableInvertedIndexChildrenArray<I extends SerializableDocumentId>(
  children: SerializableInvertedIndexNode<I>[] | undefined,
  documents: Map<I, DocumentDetails<I>>,
): InvertedIndexNode<I> | null {
  if (children === void 0) {
    return null;
  }
  let first: InvertedIndexNode<I> | null = null;
  let prev: InvertedIndexNode<I> | null = null;
  for (let i = 0; i < children.length; i++) {
    const n = fromSerializableInvertedIndexNode(children[i], documents);
    if (prev !== null) {
      prev.next = n;
      prev = n;
    } else {
      first = prev = n;
    }
  }
  return first;
}

function fromSerializableDocumentPointerArray<I extends SerializableDocumentId>(
  postings: SerializableDocumentPointer<I>[] | undefined,
  documents: Map<I, DocumentDetails<I>>,
): DocumentPointer<I> | null {
  if (postings === void 0) {
    return null;
  }
  let first: DocumentPointer<I> | null = null;
  let prev: DocumentPointer<I> | null = null;
  for (let i = 0; i < postings.length; i++) {
    const p = postings[i];
    const n: DocumentPointer<I> = {
      next: null,
      details: documents.get(p.id)!,
      termFrequency: p.termFrequency,
    };
    if (prev !== null) {
      prev.next = n;
      prev = n;
    } else {
      first = prev = n;
    }
  }
  return first;
}
