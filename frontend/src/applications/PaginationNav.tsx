type Props = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const buttonClass =
  'rounded border border-gray-400 px-3 py-1.5 enabled:hover:bg-gray-100 disabled:opacity-50'

export function PaginationNav({ page, totalPages, onPageChange }: Props) {
  return (
    // aria-label names the landmark: a screen reader lists it as "Pagination".
    <nav aria-label="Pagination" className="flex items-center gap-4">
      <button
        type="button"
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Page précédente
      </button>
      <span>
        Page {page} sur {totalPages}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Page suivante
      </button>
    </nav>
  )
}
