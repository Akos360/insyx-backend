import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Interim user store on this repo's own Postgres, not insyx-database — superseded once the lakehouse gets real users. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Always lower-cased in UsersService before insert/lookup — Postgres has no case-insensitive unique constraint.
  @Column({ unique: true })
  email: string;

  // Not collected at registration — only ever set via the Settings page.
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  affiliation: string | null;

  // Null for Google-only accounts — login() must reject this explicitly, not call bcrypt.compare(null).
  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  // Google's "sub" claim — set once a user links or signs up via Google.
  @Column({ type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

  // SHA-256, not bcrypt: a high-entropy random token doesn't need bcrypt's deliberate slowness.
  @Column({ type: 'varchar', nullable: true })
  resetTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resetTokenExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
