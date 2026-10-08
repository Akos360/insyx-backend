import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Managed by migration rather than TypeORM's development synchronization.
@Entity({ name: 'users', schema: 'public', synchronize: false })
export class User {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  @Column({ type: 'varchar', length: 254, unique: true })
  email: string;

  @ApiProperty({ example: 'Alex Smith' })
  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ name: 'avatar_url', type: 'varchar', length: 2048, nullable: true })
  avatarUrl: string | null;

  // Only a future authentication service may assign a verified Google token's sub.
  @Column({
    name: 'google_subject',
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
    select: false,
  })
  googleSubject: string | null;

  @ApiProperty()
  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
