import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InstitutionsService } from './institutions.service';

@ApiTags('institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly service: InstitutionsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search institutions by name' })
  @ApiQuery({ name: 'q', required: true, type: String })
  search(@Query('q') q = '') {
    return this.service.searchInstitutions(q);
  }

  @Get('works')
  @ApiOperation({ summary: 'Get works for an institution' })
  @ApiQuery({ name: 'id', required: true, type: String })
  getWorks(@Query('id') id = '') {
    return this.service.getInstitutionWorks(id);
  }

  @Get('map')
  @ApiOperation({
    summary: 'Institution map features',
    description:
      'Returns a GeoJSON FeatureCollection of institutions scored by work count and citations. ' +
      'The zoom level controls how many institutions are returned: low zoom → top tier only, ' +
      'high zoom → full dataset filtered by bbox.',
  })
  @ApiQuery({ name: 'zoom',   required: false, type: Number, example: 2 })
  @ApiQuery({ name: 'minLng', required: false, type: Number, example: -180 })
  @ApiQuery({ name: 'minLat', required: false, type: Number, example: -90 })
  @ApiQuery({ name: 'maxLng', required: false, type: Number, example: 180 })
  @ApiQuery({ name: 'maxLat', required: false, type: Number, example: 90 })
  getMap(
    @Query('zoom')   zoom?:   string,
    @Query('minLng') minLng?: string,
    @Query('minLat') minLat?: string,
    @Query('maxLng') maxLng?: string,
    @Query('maxLat') maxLat?: string,
  ) {
    return this.service.getMapFeatures({
      zoom:   parseFloat(zoom   ?? '0'),
      minLng: parseFloat(minLng ?? '-180'),
      minLat: parseFloat(minLat ?? '-90'),
      maxLng: parseFloat(maxLng ?? '180'),
      maxLat: parseFloat(maxLat ?? '90'),
    });
  }
}
