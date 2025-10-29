declare module 'react-image-annotation' {
  import * as React from 'react'
  const Annotation: React.ComponentType<any>
  export default Annotation
}

declare module 'react-image-annotation/lib/selectors' {
  export const RectangleSelector: { TYPE: string }
  export const PointSelector: { TYPE: string }
  export const OvalSelector: { TYPE: string }
}
