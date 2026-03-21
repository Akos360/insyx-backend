import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Paper } from '../papers/paper.entity';

@Entity('authors')
export class Author {
  @ApiProperty({ example: 'W2963403868', description: 'OpenAlex work ID (composite PK)' })
  @PrimaryColumn({ name: 'paper_id' })
  paperId: string;

  @ApiProperty({ example: 'A2963403001', description: 'OpenAlex author ID (composite PK)' })
  @PrimaryColumn({ name: 'author_id' })
  authorId: string;

  @ApiPropertyOptional({ example: 'Ashish Vaswani' })
  @Column({ name: 'display_name', nullable: true })
  displayName: string;

  @ApiPropertyOptional({ example: '0000-0002-9606-3880' })
  @Column({ nullable: true })
  orcid: string;

  @ApiPropertyOptional({ example: 'I1347872837' })
  @Column({ name: 'first_institution_id', nullable: true })
  firstInstitutionId: string;

  @ApiPropertyOptional({ example: 'Google Brain' })
  @Column({ name: 'first_institution_name', nullable: true })
  firstInstitutionName: string;

  @ApiPropertyOptional({ example: 'US' })
  @Column({ name: 'country_code', nullable: true })
  countryCode: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @Column({ name: 'institutions_full', type: 'jsonb', nullable: true })
  institutionsFull: object;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @Column({ name: 'institutions_raw', type: 'jsonb', nullable: true })
  institutionsRaw: object;

  @ApiPropertyOptional({ example: 2017 })
  @Column({ name: 'publication_year', nullable: true })
  publicationYear: number;

  @ApiPropertyOptional({ example: '2017-06-12' })
  @Column({ name: 'publication_date', nullable: true })
  publicationDate: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Paper, (paper) => paper.authorsList)
  @JoinColumn({ name: 'paper_id' })
  paper: Paper;
}