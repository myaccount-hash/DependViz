import ForceGraph3D from '3d-force-graph';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphRenderer from './GraphRenderer';

/**
 * 3Dグラフのレンダリングと更新を管理するクラス
 */

class GraphRenderer3D extends GraphRenderer {
  createLabelRenderer() {
    return {
      apply: (graph, getNodeProps) => {
        const getFontSize = () => this.state.controls.textSize || 12;
        const getLabel = (node, props) => props?.label || node.name || node.id;

        graph.nodeThreeObject(node => {
          const props = getNodeProps(node);
          const div = document.createElement('div');
          div.textContent = getLabel(node, props);

          // 透明度を色とopacityの両方で反映
          const opacity = props.opacity !== undefined ? props.opacity : 1;

          Object.assign(div.style, {
            fontSize: `${getFontSize()}px`,
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
      clear: (graph) => {
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

  focusNode(node) {
    if (!this.state.graph || !node) return;

    if (node.x === undefined || node.y === undefined || node.z === undefined) {
      setTimeout(() => this.focusNode(node), 100);
      return;
    }

    const controls = this.state.graph.controls ? this.state.graph.controls() : null;
    const target = {
      x: node.x || 0,
      y: node.y || 0,
      z: node.z || 0
    };

    const currentCameraPos = this.state.graph.cameraPosition();
    const currentTarget = controls ? controls.target : { x: 0, y: 0, z: 0 };
    const offset = {
      x: currentCameraPos.x - currentTarget.x,
      y: currentCameraPos.y - currentTarget.y,
      z: currentCameraPos.z - currentTarget.z
    };
    const offsetLen = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2) || 1;
    const focusDistance = this.state.controls.focusDistance || offsetLen;
    const scale = focusDistance / offsetLen;
    const cameraPos = {
      x: target.x + offset.x * scale,
      y: target.y + offset.y * scale,
      z: target.z + offset.z * scale
    };

    if (controls) {
      controls.target.set(target.x, target.y, target.z);
    }

    const delay = this._getAutoRotateDelay();
    this.state.graph.cameraPosition(cameraPos, target, delay);
    setTimeout(() => this.updateAutoRotation(), delay);
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

  setupEventListeners(graph) {
    const controls = graph.controls();
    if (controls) {
      const delay = this._getAutoRotateDelay();
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
        }, delay);
      });
    }
  }

  onGraphUpdated() {
    this.updateAutoRotation();
  }

  cancelRotation() {
    if (this.state.rotation.frame) {
      cancelAnimationFrame(this.state.rotation.frame);
      this.state.rotation.frame = null;
    }
    clearTimeout(this.state.rotation.timeout);
  }

  _getAutoRotateDelay() {
    return this.state.controls.autoRotateDelay || 1000;
  }

  updateAutoRotation() {
    this.cancelRotation();
    if (!this.state.graph) return;

    if (this.state.controls.autoRotate && !this.state.ui.isUserInteracting) {
      const pos = this.state.graph.cameraPosition();
      const controls = this.state.graph.controls();
      const target = controls ? controls.target : { x: 0, y: 0, z: 0 };

      this.state.rotation.startAngle = Math.atan2(pos.x - target.x, pos.z - target.z);
      this.state.rotation.startTime = Date.now();

      const rotate = () => {
        const camera = this.state.graph.camera();
        const controls = this.state.graph.controls();
        if (camera && controls) {
          if (this.state.ui.focusedNode) {
            controls.target.set(
              this.state.ui.focusedNode.x || 0,
              this.state.ui.focusedNode.y || 0,
              this.state.ui.focusedNode.z || 0
            );
          }
          const elapsed = (Date.now() - this.state.rotation.startTime) * 0.001;
          const angle = this.state.rotation.startAngle + elapsed * this.state.controls.rotateSpeed;
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
      const keepFocus = () => {
        const controls = this.state.graph.controls();
        if (controls && this.state.ui.focusedNode) {
          controls.target.set(
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
