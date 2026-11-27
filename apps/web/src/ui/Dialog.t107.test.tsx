/**
 * T107 (red, test-first) [FR-048]: the shared dialog primitive, tested directly. FR-048 dialog rules
 * (as given in tasks.md T107): focus to the heading on open, focus kept inside, Escape closes,
 * focus returns to the opener on close. Contract: `Dialog` from ./Dialog with props
 * { titleId, onClose, closeOnEscape? = true, returnFocus?, className?, children }.
 */
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';

afterEach(cleanup);

function Host({ onClose = () => undefined, closeOnEscape, useRef: useReturn = false, headingTabIndex }: { onClose?: () => void; closeOnEscape?: boolean; useRef?: boolean; headingTabIndex?: number }) {
  const [open, setOpen] = useState(false);
  const ret = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button>before</button>
      <button ref={ret} onClick={() => setOpen(true)}>Open</button>
      <button onClick={() => setOpen(true)}>Other opener</button>
      <button>after</button>
      {open && (
        <Dialog titleId="d-h" onClose={() => { onClose(); setOpen(false); }} closeOnEscape={closeOnEscape} returnFocus={useReturn ? ret : undefined} className="confirm">
          <h3 id="d-h" tabIndex={headingTabIndex}>Title</h3>
          <button>First</button>
          <button>Last</button>
        </Dialog>
      )}
    </div>
  );
}

describe('[T107][FR-048] Dialog markup', () => {
  it('role dialog, aria-modal true, labelled by the title, inside a .dialog-backdrop wrapper', async () => {
    const user = userEvent.setup();
    const { container } = render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const d = screen.getByRole('dialog', { name: 'Title' });
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-labelledby')).toBe('d-h');
    expect(d.closest('.dialog-backdrop'), 'wrapper').toBeTruthy();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(d.classList.contains('confirm') || d.parentElement!.classList.contains('confirm') || !!d.querySelector('.confirm')).toBe(true);
  });
});

describe('[T107][FR-048] focus on open', () => {
  it('focuses the element with the title id', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Title' }));
  });
  it('gives the title tabIndex -1 when it has none', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('heading', { name: 'Title' }).getAttribute('tabindex')).toBe('-1');
  });
  it('keeps a tabIndex the title already has', async () => {
    const user = userEvent.setup();
    render(<Host headingTabIndex={-1} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Title' }));
  });
});

describe('[T107][FR-048] focus stays inside', () => {
  it('Tab and Shift+Tab cycle among the dialog controls and never reach the page behind', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const d = screen.getByRole('dialog');
    for (let i = 0; i < 7; i++) {
      await user.tab();
      expect(d.contains(document.activeElement), `after ${i + 1} Tab presses focus is on ${document.activeElement?.outerHTML.slice(0, 60)}`).toBe(true);
    }
    for (let i = 0; i < 7; i++) {
      await user.tab({ shift: true });
      expect(d.contains(document.activeElement), `after ${i + 1} Shift+Tab presses`).toBe(true);
    }
  });
  it('Tab visits both buttons in DOM order', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
  });
  it('Shift+Tab from the heading wraps to the last control; Tab from the last control wraps inside', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
    await user.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'after' }));
  });
});

describe('[T107][FR-048] Escape', () => {
  it('calls onClose by default', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('calls onClose from a focused control inside', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} closeOnEscape />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.tab();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('does nothing when closeOnEscape is false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} closeOnEscape={false} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('[T107][FR-048] focus returns on unmount', () => {
  it('to the element focused when the dialog mounted (no returnFocus)', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const other = screen.getByRole('button', { name: 'Other opener' });
    await user.click(other);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(other);
  });
  it('to returnFocus.current when given, even if another element opened it', async () => {
    const user = userEvent.setup();
    render(<Host useRef />);
    await user.click(screen.getByRole('button', { name: 'Other opener' }));
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }));
  });
  it('falls back to the previously focused element when returnFocus.current is not connected', async () => {
    const user = userEvent.setup();
    function Gone() {
      const [open, setOpen] = useState(false);
      const [showRet, setShowRet] = useState(true);
      const ret = useRef<HTMLButtonElement>(null);
      return (
        <div>
          {showRet && <button ref={ret}>ret</button>}
          <button onClick={() => setOpen(true)}>Opener</button>
          {open && (
            <Dialog titleId="g-h" returnFocus={ret} onClose={() => { setShowRet(false); setOpen(false); }}>
              <h3 id="g-h">Gone</h3><button>x</button>
            </Dialog>
          )}
        </div>
      );
    }
    render(<Gone />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'ret' })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
  it('to the opener when a control inside closes it (not only Escape)', async () => {
    const user = userEvent.setup();
    function Closer() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Opener</button>
          {open && <Dialog titleId="c-h" onClose={() => setOpen(false)}><h3 id="c-h">C</h3><button onClick={() => setOpen(false)}>Cancel</button></Dialog>}
        </div>
      );
    }
    render(<Closer />);
    await user.click(screen.getByRole('button', { name: 'Opener' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Opener' }));
  });
});

describe.each([['sibling'], ['nested in the first dialog']])('[T107][FR-048] two dialogs, second opened from inside the first (%s)', (mode) => {
  function Two({ log }: { log: string[] }) {
    const [one, setOne] = useState(false);
    const [two, setTwo] = useState(false);
    const second = two && (
      <Dialog titleId="two-h" onClose={() => { log.push('close2'); setTwo(false); }}>
        <h3 id="two-h">Second</h3><button>S1</button><button>S2</button>
      </Dialog>
    );
    return (
      <div>
        <button onClick={() => setOne(true)}>Open one</button>
        <button>outside</button>
        {one && (
          <Dialog titleId="one-h" onClose={() => { log.push('close1'); setOne(false); }}>
            <h3 id="one-h">First</h3>
            <button onClick={() => setTwo(true)}>Open second</button>
            <button>F2</button>
            {mode === 'nested in the first dialog' && second}
          </Dialog>
        )}
        {mode === 'sibling' && second}
      </div>
    );
  }
  const openBoth = async () => {
    const user = userEvent.setup();
    const log: string[] = [];
    render(<Two log={log} />);
    await user.click(screen.getByRole('button', { name: 'Open one' }));
    await user.click(screen.getByRole('button', { name: 'Open second' }));
    return { user, log };
  };

  it('focus is in the topmost dialog and stays there while tabbing', async () => {
    const { user } = await openBoth();
    const top = screen.getByRole('dialog', { name: 'Second' });
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Second' }));
    for (let i = 0; i < 6; i++) { await user.tab(); expect(top.contains(document.activeElement), `Tab ${i + 1}`).toBe(true); }
    for (let i = 0; i < 6; i++) { await user.tab({ shift: true }); expect(top.contains(document.activeElement), `Shift+Tab ${i + 1}`).toBe(true); }
  });

  it('Escape closes only the top dialog and focus returns to its opener inside the first', async () => {
    const { user, log } = await openBoth();
    await user.keyboard('{Escape}');
    expect(log).toEqual(['close2']);
    expect(screen.queryByRole('dialog', { name: 'Second' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'First' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open second' }));
  });

  it('after the top one closes, the first dialog trap works again', async () => {
    const { user } = await openBoth();
    await user.keyboard('{Escape}');
    const first = screen.getByRole('dialog', { name: 'First' });
    for (let i = 0; i < 6; i++) { await user.tab(); expect(first.contains(document.activeElement), `Tab ${i + 1}`).toBe(true); }
    for (let i = 0; i < 6; i++) { await user.tab({ shift: true }); expect(first.contains(document.activeElement), `Shift+Tab ${i + 1}`).toBe(true); }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open one' }));
  });
});
