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

  findByPaper(paperId: string): Promise<Author[]> {
    return this.authorsRepository.find({ where: { paperId } });
  }

  findByAuthor(authorId: string): Promise<Author[]> {
    return this.authorsRepository.find({ where: { authorId } });
  }
}