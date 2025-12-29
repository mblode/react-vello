import { createElement, forwardRef } from 'react'
import type { ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react'
import type {
  CanvasProps,
  ClipPathProps,
  GroupProps,
  ImageProps,
  LinearGradientProps,
  MaskProps,
  NodeRef,
  PathProps,
  RadialGradientProps,
  RectProps,
  TextProps,
} from './types'
import type { HostType } from './runtime'

type WithChildren<Props> = Props & { children?: ReactNode }

type HostComponent<Props> = ForwardRefExoticComponent<WithChildren<Props> & RefAttributes<NodeRef>>

function createHostComponent<Type extends HostType, Props>(type: Type): HostComponent<Props> {
  const Component = forwardRef<NodeRef, WithChildren<Props>>(function HostComponent(props, ref) {
    return createElement(type as unknown as string, { ...props, ref })
  })
  Component.displayName = `Host(${type})`
  return Component as HostComponent<Props>
}

export const Canvas = createHostComponent<'Canvas', CanvasProps>('Canvas')
export const Group = createHostComponent<'Group', GroupProps>('Group')
export const Rect = createHostComponent<'Rect', RectProps>('Rect')
export const Path = createHostComponent<'Path', PathProps>('Path')
export const Text = createHostComponent<'Text', TextProps>('Text')
export const Image = createHostComponent<'Image', ImageProps>('Image')
export const LinearGradient = createHostComponent<'LinearGradient', LinearGradientProps>('LinearGradient')
export const RadialGradient = createHostComponent<'RadialGradient', RadialGradientProps>('RadialGradient')
export const Mask = createHostComponent<'Mask', MaskProps>('Mask')
export const ClipPath = createHostComponent<'ClipPath', ClipPathProps>('ClipPath')

export type { HostComponent }
