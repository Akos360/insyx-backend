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
}
