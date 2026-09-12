import React, { useState, useMemo } from 'react';

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (id: string) => void;
  searchPlaceholder?: string;
  title?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onAdd,
  onEdit,
  onDelete,
  searchPlaceholder = 'Search...',
  title,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Get unique values for filterable columns
  const getFilterOptions = (columnKey: string) => {
    const values = data.map((item) => (item as Record<string, unknown>)[columnKey]);
    const uniqueValues = [...new Set(values)].filter(Boolean);
    return uniqueValues.sort();
  };

  // Filter data based on search term and filters
  const filteredData = useMemo(() => {
    let filtered = data;

    // Apply search term
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([columnKey, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter((item) =>
          String((item as Record<string, unknown>)[columnKey])
            .toLowerCase()
            .includes(filterValue.toLowerCase()),
        );
      }
    });

    return filtered;
  }, [data, searchTerm, filters]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortColumn] as string | number;
      const bValue = (b as Record<string, unknown>)[sortColumn] as string | number;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      onDelete?.(id);
    }
  };

  return (
    <div className="data-table-container">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {onAdd && (
            <button onClick={onAdd} className="glass-button primary">
              + Add New
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {columns
          .filter((column) => {
            const options = getFilterOptions(String(column.key));
            return options.length > 1 && options.length <= 10; // Only show filters for columns with 2-10 unique values
          })
          .map((column) => {
            const options = getFilterOptions(String(column.key));
            return (
              <div key={String(column.key)} className="flex items-center gap-2">
                <label className="text-sm text-gray-300">{column.label}:</label>
                <select
                  value={filters[String(column.key)] || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters((prev) => ({
                      ...prev,
                      [String(column.key)]: value,
                    }));
                  }}
                  className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  {options.map((option) => (
                    <option key={String(option)} value={String(option)}>
                      {String(option)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        {Object.keys(filters).length > 0 && (
          <button
            onClick={() => setFilters({})}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-700">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-600' : ''
                  }`}
                  onClick={() =>
                    column.sortable && handleSort(String(column.key))
                  }
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable && sortColumn === column.key && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  {searchTerm
                    ? 'No items match your search.'
                    : 'No items found.'}
                </td>
              </tr>
            ) : (
              sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-700">
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="px-4 py-3 text-sm text-gray-300"
                    >
                      {
                                            column.render
                                              ? column.render((item as Record<string, unknown>)[column.key as string] as T[keyof T], item)
                                              : String((item as Record<string, unknown>)[column.key as string] || '')
                                          }
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-3 text-right space-x-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-4 text-sm text-gray-400">
        Showing {sortedData.length} of {data.length} items
        {searchTerm && ` (filtered from ${data.length})`}
      </div>
    </div>
  );
}
