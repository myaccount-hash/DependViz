import ForceGraph3D from '3d-force-graph';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphRenderer from './GraphRenderer';

/**
 * 3Dグラフのレンダリングと更新を管理するクラス
 */

class GraphRenderer3D extends GraphRenderer {
  createLabelRenderer(ctx) {
    return {
      apply: graph => {
        graph.nodeThreeObject(node => {
          const props = this.getNodeVisualProps(node, ctx);
          const div = document.createElement('div');
          div.textContent = props?.label || node.name || node.id;

          // 透明度を色とopacityの両方で反映
          const opacity = props.opacity !== undefined ? props.opacity : 1;

          Object.assign(div.style, {
            fontSize: `${ctx.controls.textSize || 12}px`,
            fontFamily: 'sans-serif',
            padding: '2px 4px',
            borderRadius: '2px',
            pointerEvents: 'none',
            color: props.color,
            opacity: opacity.toString()
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
    // Setup CSS2DRenderer for labels if available
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

    const controls = ctx.graph.controls ? ctx.graph.controls() : null;
    const target = {
      x: node.x || 0,
      y: node.y || 0,
      z: node.z || 0
    };

    const currentCameraPos = ctx.graph.cameraPosition();
    const currentTarget = controls ? controls.target : { x: 0, y: 0, z: 0 };
    const offset = {
      x: currentCameraPos.x - currentTarget.x,
      y: currentCameraPos.y - currentTarget.y,
      z: currentCameraPos.z - currentTarget.z
    };
    const offsetLen = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2) || 1;
    const focusDistance = ctx.controls.focusDistance || offsetLen;
    const scale = focusDistance / offsetLen;
    const cameraPos = {
      x: target.x + offset.x * scale,
      y: target.y + offset.y * scale,
      z: target.z + offset.z * scale
    };

    if (controls) {
      controls.target.set(target.x, target.y, target.z);
    }

    const delay = ctx.controls.autoRotateDelay || 1000;
    ctx.graph.cameraPosition(cameraPos, target, delay);
    setTimeout(() => this.updateAutoRotation(ctx), delay);
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
      const delay = ctx.controls.autoRotateDelay || 1000;
      controls.addEventListener('start', () => {
        ctx.ui.isUserInteracting = true;
        this.cancelRotation(ctx);
        this.updateAutoRotation(ctx);
      });
      controls.addEventListener('end', () => {
        this.cancelRotation(ctx);
        ctx.rotation.timeout = setTimeout(() => {
          ctx.ui.isUserInteracting = false;
          this.updateAutoRotation(ctx);
        }, delay);
      });
    }
  }

  onGraphUpdated(ctx) {
    this.updateAutoRotation(ctx);
  }

  cancelRotation(ctx) {
    if (ctx.rotation.frame) {
      cancelAnimationFrame(ctx.rotation.frame);
      ctx.rotation.frame = null;
    }
    clearTimeout(ctx.rotation.timeout);
  }

  updateAutoRotation(ctx) {
    this.cancelRotation(ctx);
    if (!ctx.graph) return;

    if (ctx.controls.autoRotate && !ctx.ui.isUserInteracting) {
      const pos = ctx.graph.cameraPosition();
      const controls = ctx.graph.controls();
      const target = controls ? controls.target : { x: 0, y: 0, z: 0 };

      ctx.rotation.startAngle = Math.atan2(pos.x - target.x, pos.z - target.z);
      ctx.rotation.startTime = Date.now();

      const rotate = () => {
        const camera = ctx.graph.camera();
        const controlsLocal = ctx.graph.controls();
        if (camera && controlsLocal) {
          if (ctx.ui.focusedNode) {
            controlsLocal.target.set(
              ctx.ui.focusedNode.x || 0,
              ctx.ui.focusedNode.y || 0,
              ctx.ui.focusedNode.z || 0
            );
          }
          const elapsed = (Date.now() - ctx.rotation.startTime) * 0.001;
          const angle = ctx.rotation.startAngle + elapsed * ctx.controls.rotateSpeed;
          const distance = Math.sqrt(
            (camera.position.x - controlsLocal.target.x) ** 2 +
            (camera.position.z - controlsLocal.target.z) ** 2
          );
          camera.position.x = controlsLocal.target.x + distance * Math.sin(angle);
          camera.position.z = controlsLocal.target.z + distance * Math.cos(angle);
          camera.lookAt(controlsLocal.target);
        }
        ctx.rotation.frame = requestAnimationFrame(rotate);
      };
      rotate();
    } else if (ctx.ui.focusedNode) {
      const keepFocus = () => {
        const controlsLocal = ctx.graph.controls();
        if (controlsLocal && ctx.ui.focusedNode) {
          controlsLocal.target.set(
            ctx.ui.focusedNode.x || 0,
            ctx.ui.focusedNode.y || 0,
            ctx.ui.focusedNode.z || 0
          );
        }
        ctx.rotation.frame = requestAnimationFrame(keepFocus);
      };
      keepFocus();
    }
  }
}

export default GraphRenderer3D;
