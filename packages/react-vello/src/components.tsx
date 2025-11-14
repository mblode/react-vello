import { createElement } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type {
  CanvasProps,
  ClipPathProps,
  GroupProps,
  ImageProps,
  LinearGradientProps,
  MaskProps,
  PathProps,
  RadialGradientProps,
  RectProps,
  TextProps,
} from '@react-vello/types'
import type { HostType } from './runtime'

type HostComponent<Props> = ComponentType<Props>

type WithChildren<Props> = Props & { children?: ReactNode }

function createHostComponent<Type extends HostType, Props>(type: Type): HostComponent<Props> {
  const Component = (props: WithChildren<Props>) => createElement(type as unknown as string, props)
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
