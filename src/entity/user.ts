import Database from '../utils/database';
import Result from '../utils/result';
import { hash, compare } from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Entity, PrimaryGeneratedColumn, Index, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('users')
export default class User {

  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', unique: true, nullable: false })
  ukey: string;

  @Index({ unique: true })
  @Column({ nullable: false, length: 50, unique: true })
  email: string;

  @Column({ nullable: false, length: 100 })
  password: string;

  @Column({ nullable: false, default: false })
  confirmed: boolean;

  @Column({ name: 'refresh_index', nullable: false, default: 0 })
  refreshIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  constructor(email: string, password: string, refreshIndex: number) {
    this.id = 0;
    this.ukey = "";
    this.email = email;
    this.password = password;
    this.confirmed = true;
    this.refreshIndex = refreshIndex;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static async register(email: string, password: string, confirmation: string): Promise<Result<User>> {
    if (password != confirmation)
      return new Result<User>(new Error('Passwords do not match'), 400);

    const u = await User.getByEmail(email);
    if (u != undefined)
      return new Result<User>(new Error('User exists'), 400);

    try {
      const hpass = await hash(password, 12);
      const user = new User(email, hpass, 0);
      user.ukey = uuidv4();
      if (await user.save())
        return new Result<User>(user, 201);
      return new Result<User>(new Error('Registration failed'), 500);
    } catch (err) {
      console.log(err);
      return new Result<User>(new Error('Registration failed'), 500);
    }
  }

  static async login(email: string, password: string): Promise<Result<User>> {
    const user = await User.getByEmail(email);
    if (user == undefined)
      return new Result<any>(new Error('Invalid credentials'), 400);

    if (!user.confirmed)
      return new Result<any>(new Error('User not confirmed'), 401);

    try {
      const valid = await compare(password, user.password);
      return valid ? new Result(user, 200) : new Result<any>(new Error('Invalid credentials'), 400);
    } catch (err) {
      console.log(err);
      return new Result<any>(new Error('Login failed'), 500);
    }
  }

  static async getByUserKey(ukey: string, refreshIndex: number): Promise<User | undefined> {
    const db = new Database<User>(User);
    const user = await db.get({ ukey });
    return user == undefined || user.refreshIndex != refreshIndex ? undefined : user;
  }

  static async getByEmail(email: string): Promise<User | undefined> {
    const db = new Database<User>(User);
    return await db.get({ email });
  }

  async save(): Promise<boolean> {
    const db = new Database<User>(User);
    return await db.save(this);
  }

  async updateConfirmed(): Promise<Result<boolean>> {
    if (this.confirmed)
      return new Result<boolean>(new Error('Already confirmed'), 401);
    const values = { confirmed: true };
    const filter = `id = ${this.id}`;
    const db = new Database<User>(User);
    const success = await db.update('users', values, filter);
    return success ? new Result<boolean>(true, 200) : new Result<boolean>(new Error('Confirmation failed'), 500);
  }

  async updatePassword(oldPassword: string | undefined, newPassword: string): Promise<Result<boolean>> {
    // change password scenario
    if (oldPassword != undefined && oldPassword == newPassword)
      return new Result<boolean>(new Error('No password change'), 400);
    const hpass = await hash(newPassword, 12);
    const values = { password: hpass };
    const filter = `id = ${this.id}`;
    const db = new Database<User>(User);
    const success = await db.update('users', values, filter);
    return success ? new Result<boolean>(true, 200) : new Result<boolean>(new Error('Update password failed'), 500);
  }

  async updateRefreshIndex(): Promise<Result<boolean>> {
    const values = { refreshIndex: () => 'refresh_index + 1' };
    const filter = `id = ${this.id}`;
    const db = new Database<User>(User);
    const success = await db.update('users', values, filter);
    return success ? new Result(true, 200) : new Result<boolean>(new Error('Refresh failed'), 500);
  }
}