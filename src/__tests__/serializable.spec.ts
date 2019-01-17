import { createIndex, addDocumentToIndex } from "ndx";
import { toSerializable, fromSerializable } from "..";

const tokenizer = (s: string) => s.split(" ");
const filter = (s: string) => s;

test("should convert to serializable data structure", () => {
  const idx = createIndex<number>(2);
  const docs = [
    { id: 1, title: "a b c", text: "hello world" },
    { id: 2, title: "c d e", text: "lorem ipsum" },
  ];
  docs.forEach((doc) => {
    addDocumentToIndex(idx, [(d) => d.title, (d) => d.text], tokenizer, filter, doc.id, doc);
  });
  expect(toSerializable(idx)).toMatchSnapshot();
});

test("should convert from serializable data structure", () => {
  const idx = createIndex<number>(2);
  const docs = [
    { id: 1, title: "a b c", text: "hello world" },
    { id: 2, title: "c d e", text: "lorem ipsum" },
  ];
  docs.forEach((doc) => {
    addDocumentToIndex(idx, [(d) => d.title, (d) => d.text], tokenizer, filter, doc.id, doc);
  });
  expect(fromSerializable(toSerializable(idx))).toEqual(idx);
});
