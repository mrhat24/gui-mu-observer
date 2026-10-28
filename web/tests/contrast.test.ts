import { describe, expect, it } from 'vitest';
import { colors } from '../src/designTokens';

function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
describe('контраст обычного текста WCAG AA', () => {
  it.each([colors.background, colors.surface, '#131814', '#20281c'])(
    'подписи читаются на фоне %s',
    (surface) => {
      expect(contrast(colors.secondaryText, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.text, surface)).toBeGreaterThanOrEqual(4.5);
    },
  );
  it('текст заполненной основной кнопки читается на зелёном фоне', () => {
    expect(contrast(colors.primaryText, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
