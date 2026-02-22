'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DragEndEvent } from '@dnd-kit/core'
import type { NihTask } from '../types'
import TaskCard from './TaskCard'

interface SortableTaskCardProps {
  task: NihTask
  subtasks: NihTask[]
  onEdit: (task: NihTask) => void
  onComplete: (task: NihTask) => void
  onDelete: (id: string) => void
  onStatusToggle: (task: NihTask) => void
  onSubtaskToggle: (subtask: NihTask) => void
  onAddSubtask: (parentId: string, title: string) => void
  onSubtaskDragEnd: (parentId: string, event: DragEndEvent) => void
}

export default function SortableTaskCard(props: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskCard
        {...props}
        dragListeners={listeners}
        isDragging={isDragging}
      />
    </div>
  )
}
