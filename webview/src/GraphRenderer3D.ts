import ForceGraph3D from '3d-force-graph';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphRenderer from './GraphRenderer';
import type {
  GraphNode,
  GraphViewModel,
  LabelRenderer,
  NodeVisualProps,
  ForceGraph3DInstance,
  GraphInstance
} from './types';

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface OrbitControls {
  target: Vector3;
  addEventListener(event: string, callback: () => void): void;
}

/**
 * 3Dグラフのレンダリングと更新を管理するクラス
 */
class GraphRenderer3D extends GraphRenderer {
  constructor(state: GraphViewModel) {
    super(state);
  }

  createLabelRenderer(): LabelRenderer {
    return {
      apply: (graph, getNodeProps) => {
        const getFontSize = (): number => this.state.controls.nameFontSize || 12;
        const getLabel = (node: GraphNode, props: NodeVisualProps | null): string =>
          props?.label || node.name || node.id;

        const graph3D = graph as ForceGraph3DInstance;
        graph3D.nodeThreeObject((node: any) => {
          const graphNode = node as GraphNode;
          const props = getNodeProps(graphNode);
          const div = document.createElement('div');
          div.textContent = getLabel(graphNode, props);

          // 透明度を色とopacityの両方で反映
          const opacity = props?.opacity !== undefined ? props.opacity : 1;

          Object.assign(div.style, {
            fontSize: `${getFontSize()}px`,
            fontFamily: 'sans-serif',
            padding: '2px 4px',
            borderRadius: '2px',
            pointerEvents: 'none',
            color: props?.color || '#ffffff',
            opacity: opacity.toString()
          });
          const label = new CSS2DObject(div);
          label.position.set(0, -8, 0);
          return label;
        }).nodeThreeObjectExtend(true);
      },
      clear: (graph) => {
        const graph3D = graph as ForceGraph3DInstance;
        graph3D.nodeThreeObject(null).nodeThreeObjectExtend(false);
      }
    };
  }

  createGraph(container: HTMLElement): ForceGraph3DInstance {
    // Setup CSS2DRenderer for labels if available
    let extraRenderers: CSS2DRenderer[] = [];
    if (CSS2DRenderer) {
      const renderer = new CSS2DRenderer();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.pointerEvents = 'none';
      container.appendChild(renderer.domElement);
      this.state.setLabelRenderer(renderer);
      extraRenderers = [renderer];
    }

    return (ForceGraph3D as any)({ extraRenderers })(container);
  }

  focusNode(node: GraphNode): void {
    if (!this.state.graph || !node) return;

    if (node.x === undefined || node.y === undefined || node.z === undefined) {
      setTimeout(() => this.focusNode(node), 100);
      return;
    }

    const graph3D = this.state.graph as ForceGraph3DInstance;
    const controls = graph3D.controls ? (graph3D.controls() as OrbitControls) : null;
    const target: Vector3 = {
      x: node.x || 0,
      y: node.y || 0,
      z: node.z || 0
    };

    const currentCameraPos = graph3D.cameraPosition() as Vector3;
    const currentTarget = controls ? controls.target : { x: 0, y: 0, z: 0 };
    const offset: Vector3 = {
      x: currentCameraPos.x - currentTarget.x,
      y: currentCameraPos.y - currentTarget.y,
      z: currentCameraPos.z - currentTarget.z
    };
    const offsetLen = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2) || 1;
    const focusDistance = this.state.controls.focusDistance || offsetLen;
    const scale = focusDistance / offsetLen;
    const cameraPos: Vector3 = {
      x: target.x + offset.x * scale,
      y: target.y + offset.y * scale,
      z: target.z + offset.z * scale
    };

    if (controls) {
      (controls.target as any).set(target.x, target.y, target.z);
    }

    const AUTO_ROTATE_DELAY = this.state.controls.AUTO_ROTATE_DELAY || 1000;
    graph3D.cameraPosition(cameraPos, target, AUTO_ROTATE_DELAY);
    setTimeout(() => this.updateAutoRotation(), AUTO_ROTATE_DELAY);
  }

  checkLibraryAvailability(): boolean {
    return typeof ForceGraph3D !== 'undefined';
  }

  getLibraryName(): string {
    return 'ForceGraph3D';
  }

  getModeName(): string {
    return '3D';
  }

  setupEventListeners(graph: GraphInstance): void {
    const graph3D = graph as ForceGraph3DInstance;
    const controls = graph3D.controls ? (graph3D.controls() as OrbitControls) : null;
    if (controls) {
      const AUTO_ROTATE_DELAY = this.state.controls.AUTO_ROTATE_DELAY || 1000;
      controls.addEventListener('start', () => {
        this.state.ui.isUserInteracting = true;
        this.cancelRotation();
        this.updateAutoRotation();
      });
      controls.addEventListener('end', () => {
        this.cancelRotation();
        this.state.rotation.timeout = setTimeout(() => {
          this.state.ui.isUserInteracting = false;
          this.updateAutoRotation();
        }, AUTO_ROTATE_DELAY) as unknown as NodeJS.Timeout;
      });
    }
  }

  onGraphUpdated(): void {
    this.updateAutoRotation();
  }

  cancelRotation(): void {
    if (this.state.rotation.frame) {
      cancelAnimationFrame(this.state.rotation.frame);
      this.state.rotation.frame = null;
    }
    if (this.state.rotation.timeout) {
      clearTimeout(this.state.rotation.timeout);
    }
  }

  updateAutoRotation(): void {
    this.cancelRotation();
    if (!this.state.graph) return;

    const graph3D = this.state.graph as ForceGraph3DInstance;

    if (this.state.controls.autoRotate && !this.state.ui.isUserInteracting) {
      const pos = graph3D.cameraPosition() as Vector3;
      const controls = graph3D.controls ? (graph3D.controls() as OrbitControls) : null;
      const target = controls ? controls.target : { x: 0, y: 0, z: 0 };

      this.state.rotation.startAngle = Math.atan2(pos.x - target.x, pos.z - target.z);
      this.state.rotation.startTime = Date.now();

      const rotate = (): void => {
        const camera = graph3D.camera();
        const controls = graph3D.controls ? (graph3D.controls() as OrbitControls) : null;
        if (camera && controls) {
          if (this.state.ui.focusedNode) {
            (controls.target as any).set(
              this.state.ui.focusedNode.x || 0,
              this.state.ui.focusedNode.y || 0,
              this.state.ui.focusedNode.z || 0
            );
          }
          const elapsed = (Date.now() - this.state.rotation.startTime!) * 0.001;
          const angle = this.state.rotation.startAngle! + elapsed * this.state.controls.rotateSpeed;
          const distance = Math.sqrt(
            (camera.position.x - controls.target.x) ** 2 +
            (camera.position.z - controls.target.z) ** 2
          );
          camera.position.x = controls.target.x + distance * Math.sin(angle);
          camera.position.z = controls.target.z + distance * Math.cos(angle);
          camera.lookAt(controls.target);
        }
        this.state.rotation.frame = requestAnimationFrame(rotate);
      };
      rotate();
    } else if (this.state.ui.focusedNode) {
      const keepFocus = (): void => {
        const controls = graph3D.controls ? (graph3D.controls() as OrbitControls) : null;
        if (controls && this.state.ui.focusedNode) {
          (controls.target as any).set(
            this.state.ui.focusedNode.x || 0,
            this.state.ui.focusedNode.y || 0,
            this.state.ui.focusedNode.z || 0
          );
        }
        this.state.rotation.frame = requestAnimationFrame(keepFocus);
      };
      keepFocus();
    }
  }
}

export default GraphRenderer3D;
