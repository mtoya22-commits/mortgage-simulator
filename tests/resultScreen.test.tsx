// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { ResultScreen } from '../src/features/results/ResultScreen';
import { useMortgageStore } from '../src/store/useMortgageStore';
import { strings } from '../src/strings/ja';
import type { MortgageInput } from '../src/types/mortgage';

const labels = strings.mortgageSourceLabels;
const rf = strings.result.reflect;

const input: MortgageInput = {
  currentAge: 40,
  balance: 32_000_000,
  rate: 1.2,
  rateType: 'fixed-period', // 固定期間終了後シナリオのボタンも出す
  monthlyPayment: 116_177,
  calculatedMonthlyPayment: 116_177,
  monthlyPaymentSource: 'manual',
  bonusAnnual: 0,
  remainingYears: 30,
  repayMethod: 'equal-principal',
  fixedPeriodRemainingYears: 10,
  postFixedRate: 1.8,
};

beforeEach(() => {
  useMortgageStore.setState({ phase: 'result', input });
});
afterEach(() => cleanup());

const optionByLabel = (label: string): HTMLButtonElement =>
  screen.getByRole('button', { name: new RegExp(label) }) as HTMLButtonElement;

describe('ResultScreen 反映ボタンの選択状態', () => {
  it('反映ボタンに disabled を使っていない', () => {
    render(<ResultScreen />);
    const options = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.handoff-option'),
    );
    expect(options.length).toBe(3); // current / rateAdjusted / fixedPeriod
    for (const btn of options) {
      expect(btn.disabled).toBe(false);
      expect(btn.hasAttribute('disabled')).toBe(false);
    }
  });

  it('既定では現在の返済条件が選択中（aria-pressed=true・selected class・「選択中」バッジ）', () => {
    render(<ResultScreen />);
    const current = optionByLabel(rf.current.button);
    expect(current.getAttribute('aria-pressed')).toBe('true');
    expect(current.className).toContain('handoff-option--selected');
    expect(within(current).getByText(rf.selectedBadge)).toBeTruthy();

    // 他は未選択
    expect(optionByLabel(rf.rateAdjusted.button).getAttribute('aria-pressed')).toBe('false');
  });

  it('金利変更シナリオを押すと選択が移り、保存メッセージが「金利変更シナリオ」になる', () => {
    render(<ResultScreen />);
    fireEvent.click(optionByLabel(rf.rateAdjusted.button));

    const rate = optionByLabel(rf.rateAdjusted.button);
    expect(rate.getAttribute('aria-pressed')).toBe('true');
    expect(rate.className).toContain('handoff-option--selected');
    expect(within(rate).getByText(rf.selectedBadge)).toBeTruthy();
    // 旧選択は外れる
    expect(optionByLabel(rf.current.button).getAttribute('aria-pressed')).toBe('false');

    const status = screen.getByRole('status');
    expect(status.textContent).toContain(labels.rateAdjusted);
    expect(status.textContent).not.toContain(labels.currentPlan);
  });

  it('現在の返済条件を押すと保存メッセージが「現在の返済条件」になる', () => {
    render(<ResultScreen />);
    fireEvent.click(optionByLabel(rf.current.button));
    expect(screen.getByRole('status').textContent).toContain(labels.currentPlan);
  });

  it('固定期間終了後シナリオを押すと保存メッセージが「固定期間終了後シナリオ」になる', () => {
    render(<ResultScreen />);
    fireEvent.click(optionByLabel(rf.fixedPeriod.button));
    const fp = optionByLabel(rf.fixedPeriod.button);
    expect(fp.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain(labels.fixedPeriodScenario);
  });

  it('資産推移リンクは本番URL（example.com でない）へ向く', () => {
    render(<ResultScreen />);
    const link = screen.getByRole('link', { name: new RegExp(rf.viewLifePlan) }) as HTMLAnchorElement;
    expect(link.href).toContain('fire-lifeplan-lab.com');
    expect(link.href).not.toContain('example.com');
    expect(link.href).toContain('mortgageSource=');
  });
});
