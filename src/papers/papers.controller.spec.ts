import { Test, TestingModule } from '@nestjs/testing';
import { PapersController } from './papers.controller';

describe('PapersController', () => {
  let controller: PapersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PapersController],
    }).compile();

    controller = module.get<PapersController>(PapersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
