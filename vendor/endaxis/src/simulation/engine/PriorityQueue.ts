export class PriorityQueue<T extends { time: number }> {
  private items: Array<{ item: T; priority: number }> = [];

  constructor(initialItems: T[] = []) {
    for (const item of initialItems) {
      this.enqueue(item);
    }
  }

  getItems(): T[] {
    return this.items.map(e => e.item);
  }

  /** Enqueue an item. Lower priority values are dequeued first at the same timestamp.
   *  priority 0 = input/apply events, 1 = derived events, 2 = expiry events */
  enqueue(item: T, priority: number = 0): void {
    let lo = 0;
    let hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const m = this.items[mid];
      if (!m) break;
      if (m.item.time < item.time || (m.item.time === item.time && m.priority <= priority)) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.items.splice(lo, 0, { item, priority });
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }

  /** Remove all queued items matching the predicate. Used to cancel scheduled expiry events. */
  cancel(predicate: (item: T) => boolean): void {
    this.items = this.items.filter(e => !predicate(e.item));
  }

  /** Remove and return all queued items matching the predicate. */
  collect(predicate: (item: T) => boolean): T[] {
    const collected: T[] = [];
    this.items = this.items.filter(e => {
      if (predicate(e.item)) {
        collected.push(e.item);
        return false;
      }
      return true;
    });
    return collected;
  }

  clone(): PriorityQueue<T> {
    const clone = new PriorityQueue<T>();
    clone.items = this.items.map(e => ({ ...e }));
    return clone;
  }

  toArray(): T[] {
    return this.items.map(e => e.item);
  }
}
