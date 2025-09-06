// FirestoreQueryBuilder — thin query wrapper (Phase 1 stub)
// Wraps a Firestore collection reference and chains the limited
// subset used by this project. No side effects until build().

export class FirestoreQueryBuilder {
  constructor(collectionRef) {
    this._ref = collectionRef;
    this._ops = [];
  }

  where(field, op, value) {
    this._ops.push({ type: 'where', field, op, value });
    return this;
  }

  orderBy(field, direction = 'asc') {
    this._ops.push({ type: 'orderBy', field, direction });
    return this;
  }

  limit(n) {
    this._ops.push({ type: 'limit', n });
    return this;
  }

  startAfter(cursor) {
    this._ops.push({ type: 'startAfter', cursor });
    return this;
  }

  build() {
    let q = this._ref;
    for (const op of this._ops) {
      switch (op.type) {
        case 'where':
          q = q.where(op.field, op.op, op.value);
          break;
        case 'orderBy':
          q = q.orderBy(op.field, op.direction);
          break;
        case 'limit':
          q = q.limit(op.n);
          break;
        case 'startAfter':
          q = q.startAfter(op.cursor);
          break;
      }
    }
    return q;
  }
}

export default FirestoreQueryBuilder;

