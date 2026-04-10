import type * as planck from 'planck';
import type { FixtureMeta } from '@/game/types';

export function attachSensor(
  body: planck.Body,
  shape: planck.Circle | planck.Box,
  userData: FixtureMeta,
): planck.Fixture {
  const fixture = body.createFixture({
    shape,
    isSensor: true,
  });
  fixture.setUserData(userData);
  return fixture;
}
