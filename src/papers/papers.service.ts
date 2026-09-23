import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paper } from './paper.entity';

@Injectable()
export class PapersService {
  constructor(
    @InjectRepository(Paper)
    private readonly papersRepository: Repository<Paper>,
  ) {}

  findAll(): Promise<Paper[]> {
    return this.papersRepository.find();
  }

  findById(id: string): Promise<Paper | null> {
    return this.papersRepository.findOneBy({ id });
  }

  search(q: string): Promise<Paper[]> {
    return this.papersRepository
      .createQueryBuilder('p')
      .where('p.title ILIKE :q', { q: `%${q}%` })
      .orWhere('p.abstract ILIKE :q', { q: `%${q}%` })
      .orderBy('p.citedByCount', 'DESC')
      .limit(20)
      .getMany();
  }
}
