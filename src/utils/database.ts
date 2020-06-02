import { getManager, Repository, ObjectType } from 'typeorm';

export default class Database<T> {
  repo: Repository<T>;

  constructor(entityClass: ObjectType<T>) {
    this.repo = getManager().getRepository(entityClass);
  }

  async save(entity: T): Promise<boolean> {
    try {
      await this.repo.save(entity);
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async update(table: string, values: object, filter: string): Promise<boolean> {
    try {
      const result = await this.repo
        .createQueryBuilder(table)
        .update()
        .set(values)
        .where(filter)
        .execute();
      return result.affected != undefined && result.affected > 0;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  async get(filter: object): Promise<T | undefined> {
    try {
      // e.g. filter = { ukey: '123-abc' };
      return await this.repo.findOne(filter);
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }

  async all(): Promise<T[] | undefined> {
    try {
      const rows = await this.repo.find();
      return rows;
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }
}