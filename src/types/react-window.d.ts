declare module 'react-window' {
  import * as React from 'react'

  export type Align = 'start' | 'center' | 'end' | 'auto' | undefined

  export interface ListOnItemsRenderedProps {
    overscanStartIndex: number
    overscanStopIndex: number
    visibleStartIndex: number
    visibleStopIndex: number
  }

  export interface VariableSizeListProps {
    height: number
    width: number | string
    itemCount: number
    itemSize: (index: number) => number
    overscanCount?: number
    onItemsRendered?: (props: ListOnItemsRenderedProps) => void
    children: (props: { index: number; style: React.CSSProperties }) => React.ReactNode
    itemKey?: (index: number) => string | number
    outerRef?: React.Ref<HTMLDivElement | null>
    innerRef?: React.Ref<HTMLDivElement | null>
    innerElementType?: React.ElementType
  }

  export interface VariableSizeListHandle {
    scrollTo(scrollOffset: number): void
    scrollToItem(index: number, align?: Align): void
    resetAfterIndex(index: number, shouldForceUpdate?: boolean): void
  }

  export const VariableSizeList: React.ForwardRefExoticComponent<
    VariableSizeListProps & React.RefAttributes<VariableSizeListHandle>
  >
}
