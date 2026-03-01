import { Injectable } from '@nestjs/common';

export type Paper = {
  id: string;
  title: string;
  year: number;
  authors: string[];
  abstract: string;
};

@Injectable()
export class PapersService {
  private readonly papers: Paper[] = [
    {
      id: 'p1',
      title: 'Graph Neural Networks for Citation Discovery',
      year: 2024,
      authors: ['A. Kovacs', 'L. Nagy'],
      abstract:
        'A toy paper object used to verify frontend-backend connectivity during development.',
    },
    {
      id: 'p2',
      title: 'Practical Retrieval for Academic Search',
      year: 2023,
      authors: ['J. Smith'],
      abstract: 'Second demo record for simple endpoint testing.',
    },
  ];

  findAll(): Paper[] {
    return this.papers;
  }

  findById(id: string): Paper | undefined {
    return this.papers.find((paper) => paper.id === id);
  }
}
