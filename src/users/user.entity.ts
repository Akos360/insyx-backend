import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Application account store shared by authentication and profile APIs. */
@Entity({ name: 'users', schema: 'public', synchronize: false })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email: string;

  // Not collected at registration — only ever set via the Settings page.
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  affiliation: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  avatarUrl: string | null;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
