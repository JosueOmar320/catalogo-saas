import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contrastRatio, ensureContrast } from '@/lib/design/color';
import { resolveTokens } from '@/lib/design/tokens';
import { applyPreset, THEME_PRESETS } from '@/lib/design/presets';
import { parseTheme } from '@/lib/design/theme';

describe('ensureContrast', () => {
  it('deja el color tal cual cuando ya se lee', () => {
    assert.equal(ensureContrast('#B4532A', '#FBF6F0'), '#B4532A');
  });

  it('oscurece un acento claro hasta 4.5:1 sobre fondo claro (eyebrow del preset restaurante)', () => {
    const ink = ensureContrast('#D9A441', '#FBF6F0');
    assert.notEqual(ink, '#D9A441');
    assert.ok(contrastRatio(ink, '#FBF6F0') >= 4.5);
  });

  it('aclara un acento oscuro sobre fondo oscuro', () => {
    const ink = ensureContrast('#2A2A2A', '#0E0E0E');
    assert.ok(contrastRatio(ink, '#0E0E0E') >= 4.5);
  });

  it('todos los presets tienen un acento legible como texto', () => {
    for (const preset of THEME_PRESETS) {
      const tokens = resolveTokens(applyPreset(parseTheme({}), preset));
      assert.ok(contrastRatio(tokens.colors.accentInk, tokens.colors.background) >= 4.5, preset.id);
    }
  });
});
