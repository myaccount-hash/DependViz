import ForceGraph3D from '3d-force-graph';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphRenderer from './GraphRenderer';

class GraphRenderer3D extends GraphRenderer {
  createLabelRenderer(ctx) {
    return {
      apply: graph => {
        graph.nodeThreeObject(node => {
          const props = this.getNodeVisualProps(node, ctx);
          const div = document.createElement('div');
          div.textContent = props?.label || node.name || node.id;

          Object.assign(div.style, {
            fontSize: `${ctx.controls.textSize || 12}px`,
            fontFamily: 'sans-serif',
            padding: '2px 4px',
            borderRadius: '2px',
            pointerEvents: 'none',
            color: props.color,
            opacity: (props.opacity ?? 1).toString()
          });
          
          const label = new CSS2DObject(div);
          label.position.set(0, -8, 0);
          return label;
        }).nodeThreeObjectExtend(true);
      },
      clear: graph => {
        graph.nodeThreeObject(null).nodeThreeObjectExtend(false);
      }
    };
  }

  createGraph(container) {
    let extraRenderers = [];
    if (CSS2DRenderer) {
      const renderer = new CSS2DRenderer();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.pointerEvents = 'none';
      container.appendChild(renderer.domElement);
      extraRenderers = [renderer];
    }

    return ForceGraph3D({ extraRenderers })(container);
  }

focusNode(ctx, node) {
  if (!ctx.graph || !node) return;

  if (node.x === undefined || node.y === undefined || node.z === undefined) {
    setTimeout(() => this.focusNode(ctx, node), 100);
    return;
  }

  const target = {
    x: node.x || 0,
    y: node.y || 0,
    z: node.z || 0
  };

  const currentPos = ctx.graph.cameraPosition();
  const controls = ctx.graph.controls();
  const currentTarget = controls?.target || { x: 0, y: 0, z: 0 };

  const dx = currentPos.x - currentTarget.x;
  const dy = currentPos.y - currentTarget.y;
  const dz = currentPos.z - currentTarget.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const focusDistance = ctx.controls.focusDistance || distance;
  const scale = focusDistance / distance;

  const cameraPos = {
    x: target.x + dx * scale,
    y: target.y + dy * scale,
    z: target.z + dz * scale
  };

  const duration = 1000;
  ctx.graph.cameraPosition(cameraPos, target, duration);

  setTimeout(() => {
    if (controls) {
      controls.target.set(target.x, target.y, target.z);
    }
    this.updateFocus(ctx);
  }, duration);
}

  checkLibraryAvailability() {
    return typeof ForceGraph3D !== 'undefined';
  }

  getLibraryName() {
    return 'ForceGraph3D';
  }

  getModeName() {
    return '3D';
  }

  patchControls(controls) {
    if (!controls || controls._dvTouchPatch) return;
    controls._dvTouchPatch = true;

    const ensureTouches = event => {
      if (!event || (event.touches && event.touches.length > 0)) return;
      if (event.changedTouches && event.changedTouches.length > 0) {
        event.touches = event.changedTouches;
        return;
      }
      if (event.clientX !== undefined || event.pageX !== undefined) {
        const pageX = event.pageX ?? event.clientX;
        const pageY = event.pageY ?? event.clientY;
        event.touches = [{
          pageX,
          pageY,
          clientX: event.clientX ?? pageX,
          clientY: event.clientY ?? pageY
        }];
      }
    };

    const wrapTouchHandler = name => {
      const original = typeof controls[name] === 'function' ? controls[name].bind(controls) : null;
      if (!original) return;
      controls[name] = event => {
        ensureTouches(event);
        return original(event);
      };
    };

    wrapTouchHandler('onPointerUp');
    wrapTouchHandler('onTouchEnd');
  }

  setupEventListeners(graph, ctx) {
    const controls = graph.controls();
    if (controls) {
      this.patchControls(controls);
      controls.addEventListener('start', () => {
        ctx.ui.isUserInteracting = true;
        this.cancelFocusUpdate(ctx);
      });
      controls.addEventListener('end', () => {
        ctx.ui.isUserInteracting = false;
        this.updateFocus(ctx);
      });
    }
  }

  onGraphUpdated(ctx) {
    this.updateFocus(ctx);
  }

  cancelFocusUpdate(ctx) {
    if (ctx._focusFrame) {
      cancelAnimationFrame(ctx._focusFrame);
      ctx._focusFrame = null;
    }
  }

  updateFocus(ctx) {
    this.cancelFocusUpdate(ctx);
    if (!ctx.graph || ctx.ui.isUserInteracting) return;

    if (ctx.ui.focusedNode) {
      const keepFocus = () => {
        const controlsLocal = ctx.graph.controls();
        if (controlsLocal && ctx.ui.focusedNode) {
          controlsLocal.target.set(
            ctx.ui.focusedNode.x || 0,
            ctx.ui.focusedNode.y || 0,
            ctx.ui.focusedNode.z || 0
          );
        }
        ctx._focusFrame = requestAnimationFrame(keepFocus);
      };
      keepFocus();
    }
  }
}

export default GraphRenderer3D;