import { Range, Root, Thumb, Track } from "@radix-ui/react-slider";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";

import { cn } from "@/lib/utils";

const Slider = forwardRef<
  ElementRef<typeof Root>,
  ComponentPropsWithoutRef<typeof Root>
>(({ className, ...props }, ref) => (
  <Root
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    ref={ref}
    {...props}
  >
    <Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <Range className="absolute h-full bg-primary" />
    </Track>
    <Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </Root>
));
Slider.displayName = Root.displayName;

export { Slider };
