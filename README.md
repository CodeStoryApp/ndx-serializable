# [ndx-serializable](https://github.com/ndx-search/ndx-serializable) &middot; [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ndx-search/ndx-serializable/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/ndx-serializable.svg)](https://www.npmjs.com/package/ndx-serializable) [![codecov](https://codecov.io/gh/ndx-search/ndx-serializable/branch/master/graph/badge.svg)](https://codecov.io/gh/ndx-search/ndx-serializable) [![CircleCI Status](https://circleci.com/gh/ndx-search/ndx-serializable.svg?style=shield&circle-token=:circle-token)](https://circleci.com/gh/ndx-search/ndx-serializable) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ndx-search/ndx-serializable)

Serializable data structures for [ndx](https://github.com/ndx-search/ndx) library.

## Documentation

There are two simple functions that converts `Index` data structure to serializable object and from serializable object:

```ts
function toSerializable<I extends SerializableDocumentId>(index: Index<I>): SerializableIndex<I>;
function fromSerializable<I extends SerializableDocumentId>(index: SerializableIndex<I>): Index<I>;
```

### Example

```ts
import { createIndex } from "ndx";
import { toSerializable } from "ndx-serializable";

const index = createIndex(1);
// ...

JSON.stringify(toSerializable(index));
```
