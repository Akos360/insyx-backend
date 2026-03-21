import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Author } from '../authors/author.entity';

@Entity('works')
export class Paper {
  @ApiProperty({ example: 'W2963403868', description: 'OpenAlex work ID' })
  @PrimaryColumn()
  id: string;

  @ApiPropertyOptional({ example: '10.48550/arXiv.1706.03762' })
  @Column({ nullable: true })
  doi: string;

  @ApiProperty({ example: 'Attention Is All You Need' })
  @Column()
  title: string;

  @ApiPropertyOptional({ example: 2017 })
  @Column({ name: 'publication_year', nullable: true })
  publicationYear: number;

  @ApiPropertyOptional({ example: '2017-06-12' })
  @Column({ name: 'publication_date', nullable: true })
  publicationDate: string;

  @ApiPropertyOptional({ example: 'article' })
  @Column({ nullable: true })
  type: string;

  @ApiPropertyOptional({ example: 'en' })
  @Column({ nullable: true })
  language: string;

  @ApiPropertyOptional({ example: 95300 })
  @Column({ name: 'cited_by_count', default: 0 })
  citedByCount: number;

  @ApiPropertyOptional({ example: 41 })
  @Column({ name: 'referenced_works_count', default: 0 })
  referencedWorksCount: number;

  @ApiPropertyOptional({ example: 'Computer Science' })
  @Column({ nullable: true })
  domain: string;

  @ApiPropertyOptional({ example: 'Artificial Intelligence' })
  @Column({ nullable: true })
  field: string;

  @ApiPropertyOptional({ example: 'Deep Learning' })
  @Column({ nullable: true })
  subfield: string;

  @ApiPropertyOptional({ example: 'Transformer Architecture' })
  @Column({ name: 'primary_topic', nullable: true })
  primaryTopic: string;

  @ApiPropertyOptional({ example: 'Transformers, Self-Attention, Sequence Modeling' })
  @Column({ nullable: true })
  topics: string;

  @ApiPropertyOptional({ example: 'Transformer, Self-Attention, Multi-Head Attention' })
  @Column({ nullable: true })
  concepts: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @Column({ name: 'concepts_full', type: 'jsonb', nullable: true })
  conceptsFull: object;

  @ApiPropertyOptional({ example: 'transformer, attention, neural machine translation' })
  @Column({ nullable: true })
  keywords: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @Column({ name: 'keywords_full', type: 'jsonb', nullable: true })
  keywordsFull: object;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @Column({ name: 'references_full', type: 'jsonb', nullable: true })
  referencesFull: object;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @Column({ name: 'related_full', type: 'jsonb', nullable: true })
  relatedFull: object;

  @ApiPropertyOptional({ example: 'cc-by' })
  @Column({ nullable: true })
  license: string;

  @ApiPropertyOptional({ example: 'https://arxiv.org/pdf/1706.03762' })
  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl: string;

  @ApiPropertyOptional({ example: 'The dominant sequence transduction models...' })
  @Column({ type: 'text', nullable: true })
  abstract: string;

  @ApiPropertyOptional({ example: true })
  @Column({ name: 'is_oa', default: false })
  isOa: boolean;

  @ApiPropertyOptional({ example: 'https://arxiv.org/abs/1706.03762' })
  @Column({ name: 'oa_url', nullable: true })
  oaUrl: string;

  @ApiPropertyOptional({ example: 'S4306400806' })
  @Column({ name: 'source_id', nullable: true })
  sourceId: string;

  @ApiPropertyOptional({ example: 'arXiv' })
  @Column({ name: 'source_name', nullable: true })
  sourceName: string;

  @ApiPropertyOptional({ example: 'repository' })
  @Column({ name: 'source_type', nullable: true })
  sourceType: string;

  @ApiPropertyOptional({ example: 8 })
  @Column({ name: 'num_authors', default: 0 })
  numAuthors: number;

  @ApiPropertyOptional({ example: 'A. Vaswani, N. Shazeer, N. Parmar' })
  @Column({ nullable: true })
  authors: string;

  @ApiPropertyOptional({ example: 'A2963403001|A2963403002|A2963403003' })
  @Column({ name: 'author_ids', nullable: true })
  authorIds: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @Column({ name: 'full_authors_info', type: 'jsonb', nullable: true })
  fullAuthorsInfo: object;

  @ApiPropertyOptional({ example: 'USD' })
  @Column({ name: 'apc_currency', nullable: true })
  apcCurrency: string;

  @ApiPropertyOptional({ example: 3000 })
  @Column({ name: 'apc_value', type: 'numeric', nullable: true })
  apcValue: number;

  @ApiPropertyOptional({ example: 3000 })
  @Column({ name: 'apc_usd', type: 'numeric', nullable: true })
  apcUsd: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Author, (author) => author.paper)
  authorsList: Author[];
}
