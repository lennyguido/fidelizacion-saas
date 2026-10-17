import type { CSSProperties } from 'react'
import { PRODUCTS } from './products'

const step = (i: number) => ({ '--i': i }) as CSSProperties

/**
 * La línea N: arranca en su círculo, tiene una estación por producto y se pierde
 * punteada hacia el borde (vienen más). Se dibuja una vez al cargar, sin animación
 * con "reducir movimiento"; horizontal en compu y vertical en el celular.
 */
export function LineMap() {
  return (
    <nav aria-label="Productos de Neriva">
      <ol className="metro">
        <li className="metro-stop is-head" style={step(0)}>
          <span className="metro-track" aria-hidden />
          <span className="metro-head badge" aria-label="Línea Neriva">
            N
          </span>
        </li>
        {PRODUCTS.map((product, i) => (
          <li key={product.id} className="metro-stop" style={step(i + 1)}>
            <span className="metro-track" aria-hidden />
            <span className="metro-dot" aria-hidden />
            <a href={product.href} className="metro-label group">
              <span className="wide block text-2xl group-hover:text-line lg:text-[1.75rem]">
                {product.station}
              </span>
              <span className="mt-1.5 block text-muted">{product.tagline}</span>
            </a>
          </li>
        ))}
        <li
          className="metro-stop is-next"
          style={step(PRODUCTS.length + 1)}
          aria-label="Próximamente, más herramientas"
        >
          <span className="metro-track" aria-hidden />
        </li>
      </ol>
    </nav>
  )
}
