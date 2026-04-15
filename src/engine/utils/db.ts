import Dexie, { type Table } from 'dexie';

export interface CustomImage {
  id: string;
  data: Blob | File;
}

export class MyDatabase extends Dexie {
  images!: Table<CustomImage>;

  constructor() {
    super('ValhallaMakerDB');
    this.version(1).stores({
      images: 'id'
    });
  }
}

export const db = new MyDatabase();