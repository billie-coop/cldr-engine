import { Bundle } from '../../resource';
import { Internals } from '../../internals';
import { NumberSystemType } from '../../common';
import { ContextTransformInfo, NumberParams } from '../../common/private';
import { NumberParamsCache } from './numbers';
import { vectorMapping } from '../../schema/schema/arrows';

/**
 * Private API only visible internally.
 *
 * @internal
 */
export class PrivateApiImpl {
  private numberParamsCache: NumberParamsCache;
  private contextTransforms: ContextTransformInfo;

  constructor(
    private bundle: Bundle,
    private internals: Internals,
  ) {
    this.numberParamsCache = new NumberParamsCache(bundle, internals);
    this.contextTransforms = vectorMapping(this.internals.schema.ContextTransforms.contextTransforms, this.bundle);
  }

  getNumberParams(numberSystem?: NumberSystemType, defaultSystem?: NumberSystemType): NumberParams {
    return this.numberParamsCache.getNumberParams(numberSystem, defaultSystem);
  }

  getContextTransformInfo(): ContextTransformInfo {
    return this.contextTransforms;
  }
}
