import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers';
import { ApiError, type DocumentClient, type ReadingException } from '../../shared/api/client';
import { ReadingExceptionsPage } from './ReadingExceptionsPage';

const exceptions: ReadingException[] = [
  { lemma: '行く', reading: 'イク', deletedAt: null },
  { lemma: '今日', reading: 'キョウ', deletedAt: null },
];

function client(overrides: Partial<DocumentClient> = {}): DocumentClient {
  return {
    listReadingExceptions: vi.fn().mockResolvedValue(exceptions),
    setReadingException: vi.fn().mockResolvedValue(exceptions[0]),
    deleteReadingException: vi.fn().mockResolvedValue(exceptions[0]),
    ...overrides,
  } as DocumentClient;
}

function renderPage(apiClient: DocumentClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppProviders client={apiClient}><ReadingExceptionsPage /></AppProviders>
    </QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe('reading exceptions catalogue', () => {
  it('shows loading, API-order results, and an empty state', async () => {
    const pending = deferred<ReadingException[]>();
    renderPage(client({ listReadingExceptions: vi.fn().mockReturnValue(pending.promise) }));
    expect(screen.getByRole('status')).toHaveTextContent('Carregando exceções');
    pending.resolve(exceptions);
    expect((await screen.findAllByRole('listitem')).map((row) => row.querySelector('strong')?.textContent)).toEqual(['行く', '今日']);

    renderPage(client({ listReadingExceptions: vi.fn().mockResolvedValue([]) }));
    expect(await screen.findByText('Nenhuma exceção cadastrada.')).toHaveAttribute('role', 'status');
  });

  it('shows a deterministic unavailable-client error and retries list loading', async () => {
    renderPage(client({ listReadingExceptions: undefined }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Exceções de leitura indisponíveis');

    const listReadingExceptions = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(exceptions);
    renderPage(client({ listReadingExceptions }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'Tentar novamente' })[1]);
    await waitFor(() => expect(listReadingExceptions).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('行く')).not.toHaveLength(0);
  });

  it('adds an exception only with both fields, refreshes it, clears fields, and announces success', async () => {
    const listReadingExceptions = vi.fn().mockResolvedValueOnce(exceptions).mockResolvedValueOnce([...exceptions, { lemma: '明日', reading: 'アシタ', deletedAt: null }]);
    const setReadingException = vi.fn().mockResolvedValue({ lemma: '明日', reading: 'アシタ', deletedAt: null });
    renderPage(client({ listReadingExceptions, setReadingException }));
    const add = await screen.findByRole('button', { name: 'Adicionar exceção' });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Lemma'), { target: { value: '明日' } });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Leitura'), { target: { value: 'アシタ' } });
    fireEvent.click(add);
    await waitFor(() => expect(setReadingException).toHaveBeenCalledWith('明日', { reading: 'アシタ' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Exceção adicionada.');
    expect(screen.getByLabelText('Lemma')).toHaveValue('');
    expect(screen.getByLabelText('Leitura')).toHaveValue('');
    expect(listReadingExceptions).toHaveBeenCalledTimes(2);
  });

  it('edits only the reading, saves it, and cancellation makes no API call', async () => {
    const setReadingException = vi.fn().mockResolvedValue({ lemma: '行く', reading: 'ユク', deletedAt: null });
    renderPage(client({ setReadingException }));
    await screen.findByText('行く');
    fireEvent.click(screen.getByRole('button', { name: 'Editar exceção 行く' }));
    expect(screen.getByText('行く')).toBeInTheDocument();
    expect(screen.queryByLabelText('Lemma para 行く')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Leitura para 行く'), { target: { value: 'ユク' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar leitura' }));
    await waitFor(() => expect(setReadingException).toHaveBeenCalledWith('行く', { reading: 'ユク' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Exceção atualizada.');

    fireEvent.click(screen.getByRole('button', { name: 'Editar exceção 今日' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edição' }));
    expect(setReadingException).toHaveBeenCalledTimes(1);
  });

  it('disables controls while saving and exposes a polite pending status', async () => {
    const pending = deferred<ReadingException>();
    const setReadingException = vi.fn().mockReturnValue(pending.promise);
    renderPage(client({ setReadingException }));
    await screen.findByText('行く');
    fireEvent.change(screen.getByLabelText('Lemma'), { target: { value: '明日' } });
    fireEvent.change(screen.getByLabelText('Leitura'), { target: { value: 'アシタ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar exceção' }));
    expect(screen.getByLabelText('Lemma')).toBeDisabled();
    expect(screen.getByLabelText('Leitura')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    pending.resolve({ lemma: '明日', reading: 'アシタ', deletedAt: null });
    await screen.findByText('Exceção adicionada.');
  });

  it('disables deletion confirmation controls while removal is pending', async () => {
    const pending = deferred<ReadingException>();
    const deleteReadingException = vi.fn().mockReturnValue(pending.promise);
    renderPage(client({ deleteReadingException }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remover exceção 行く' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover exceção definitivamente' }));
    expect(screen.getByRole('button', { name: 'Cancelar remoção' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Removendo exceção…' })).toBeDisabled();
    pending.resolve(exceptions[0]);
    await screen.findByText('Exceção removida.');
  });

  it('confirms removal, handles cancel and Escape accessibly, and returns focus to its trigger', async () => {
    const deleteReadingException = vi.fn().mockResolvedValue(exceptions[0]);
    renderPage(client({ deleteReadingException }));
    const remove = await screen.findByRole('button', { name: 'Remover exceção 行く' });
    remove.focus();
    fireEvent.click(remove);
    const dialog = screen.getByRole('dialog', { name: 'Remover exceção' });
    await waitFor(() => expect(dialog).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar remoção' }));
    expect(deleteReadingException).not.toHaveBeenCalled();
    await waitFor(() => expect(remove).toHaveFocus());

    fireEvent.click(remove);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Remover exceção' }), { key: 'Escape' });
    expect(deleteReadingException).not.toHaveBeenCalled();
    await waitFor(() => expect(remove).toHaveFocus());

    fireEvent.click(remove);
    fireEvent.click(screen.getByRole('button', { name: 'Remover exceção definitivamente' }));
    await waitFor(() => expect(deleteReadingException).toHaveBeenCalledWith('行く'));
    expect(await screen.findByRole('status')).toHaveTextContent('Exceção removida.');
  });

  it('displays problem details and a neutral operation fallback', async () => {
    const setReadingException = vi.fn()
      .mockRejectedValueOnce(new ApiError(422, { type: 'about:blank', title: 'Invalid', status: 422, detail: 'Leitura deve conter kana.' }))
      .mockRejectedValueOnce(new Error('offline'));
    renderPage(client({ setReadingException }));
    await screen.findByText('行く');
    fireEvent.change(screen.getByLabelText('Lemma'), { target: { value: '明日' } });
    fireEvent.change(screen.getByLabelText('Leitura'), { target: { value: 'あした' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar exceção' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Leitura deve conter kana.');
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar exceção' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível adicionar a exceção.');
  });
});
