import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Author } from './author.entity';

@Injectable()
export class AuthorsService {
  constructor(
    @InjectRepository(Author)
    private readonly authorsRepository: Repository<Author>,
  ) {}

  /** All unique authors, each with their paper count. */
  findAll(): Promise<any[]> {
    return this.authorsRepository
      .createQueryBuilder('a')
      .select('a.authorId', 'authorId')
      .addSelect('MAX(a.displayName)', 'displayName')
      .addSelect('MAX(a.firstInstitutionName)', 'firstInstitutionName')
      .addSelect('MAX(a.countryCode)', 'countryCode')
      .addSelect('MAX(a.orcid)', 'orcid')
      .addSelect('COUNT(*)', 'paperCount')
      .groupBy('a.authorId')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();
  }

  findByPaper(paperId: string): Promise<Author[]> {
    return this.authorsRepository.find({ where: { paperId } });
  }

  /** Returns all paper-author records for an author, with the full Paper loaded. */
  findByAuthor(authorId: string): Promise<Author[]> {
    return this.authorsRepository.find({
      where: { authorId },
      relations: ['paper'],
      order: { publicationYear: 'DESC' },
    });
  }
}