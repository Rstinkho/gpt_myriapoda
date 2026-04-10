export class Pool<T> {
  private readonly available: T[] = [];

  constructor(private readonly factory: () => T) {}

  acquire(): T {
    return this.available.pop() ?? this.factory();
  }

  release(item: T): void {
    this.available.push(item);
  }
}
