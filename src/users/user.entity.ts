import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Interim user store, scoped to insyx-backend's own Postgres container
 * (docker-compose.yml's `postgres` service) — NOT insyx-database (the
 * lakehouse repo, which we never touch). This exists so auth works end to
 * end right now; it's expected to be superseded once the lakehouse gets a
 * real user schema.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Always stored lower-cased — Postgres has no case-insensitive unique
  // constraint out of the box, so case-folding happens in UsersService
  // before every insert/lookup instead.
  @Column({ unique: true })
  email: string;

  // Nullable — a Google-only account (never registered with a password) has
  // none. login() must reject this case explicitly rather than calling
  // bcrypt.compare against null.
  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  // Google's "sub" claim — set once a user links or signs up via Google.
  @Column({ type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

  // Password-reset flow: a SHA-256 hash of a random single-use token (not
  // bcrypt — this is a high-entropy random value, not a low-entropy secret,
  // so it doesn't need bcrypt's deliberate slowness) plus its expiry. Both
  // null once unused or after a successful reset.
  @Column({ type: 'varchar', nullable: true })
  resetTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resetTokenExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
