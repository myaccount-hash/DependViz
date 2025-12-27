import ForceGraph3D from '3d-force-graph';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphRenderer from './GraphRenderer';

/**
 * 3Dグラフレンダリングを管理するクラス
 */
class GraphRenderer3D extends GraphRenderer {
  /**
   * 3Dノードラベルのレンダラーを作成
   * CSS2DObjectを使用してThree.jsシーンにHTML要素を配置
   * @param {Object} ctx - レンダリングコンテキスト
   * @returns {Object} apply/clearメソッドを持つレンダラーオブジェクト
   */
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

  /**
   * 3Dグラフインスタンスを作成
   * CSS2DRendererをextraRenderersとして設定し、ラベル表示を可能にする
   * @param {HTMLElement} container - グラフを表示するコンテナ要素
   * @returns {Object} ForceGraph3Dインスタンス
   */
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

  /**
   * 指定ノードにカメラをフォーカス
   * 現在のカメラ方向を維持しながら、指定した距離でノードを中心に配置
   * アニメーション完了後、controls.targetを設定してフォーカスを維持
   * @param {Object} ctx - レンダリングコンテキスト
   * @param {Object} node - フォーカス対象のノード
   */
focusNode(ctx, node) {
  if (!ctx.graph || !node) return;

  this.cancelFocusUpdate(ctx);
  ctx._isFocusing = true;

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

  ctx.graph.cameraPosition(cameraPos, target, 0);

  if (controls) {
    controls.target.set(target.x, target.y, target.z);
  }
  ctx._isFocusing = false;
  this.updateFocus(ctx);
}

updateFocus(ctx) {
  this.cancelFocusUpdate(ctx);
  if (!ctx.graph || ctx.ui.isUserInteracting || ctx._isFocusing) return;

  if (ctx.ui.focusedNode) {
    const keepFocus = () => {
      if (!ctx.ui.focusedNode || ctx.ui.isUserInteracting || ctx._isFocusing) {
        ctx._focusFrame = null;
        return;
      }

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

  /**
   * ForceGraph3Dライブラリが利用可能かチェック
   * @returns {boolean} ライブラリが利用可能な場合true
   */
  checkLibraryAvailability() {
    return typeof ForceGraph3D !== 'undefined';
  }

  /**
   * 使用するライブラリ名を取得
   * @returns {string} ライブラリ名
   */
  getLibraryName() {
    return 'ForceGraph3D';
  }

  /**
   * レンダリングモード名を取得
   * @returns {string} モード名
   */
  getModeName() {
    return '3D';
  }

  /**
   * タッチイベント処理の互換性パッチを適用
   * VSCode WebViewでのタッチイベント不具合を修正
   * @param {Object} controls - Three.jsのOrbitControls
   */
  patchControls(controls) {
    if (!controls || controls._dvTouchPatch) return;
    controls._dvTouchPatch = true;

    /**
     * イベントオブジェクトにtouchesプロパティがあることを保証
     * @param {Event} event - パッチ対象のイベント
     */
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

    /**
     * タッチイベントハンドラをラップしてensureTouchesを適用
     * @param {string} name - ラップするハンドラの名前
     */
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

  /**
   * グラフのイベントリスナーを設定
   * ユーザーインタラクション開始/終了時の処理を登録
   * @param {Object} graph - グラフインスタンス
   * @param {Object} ctx - レンダリングコンテキスト
   */
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

  /**
   * グラフ更新時のコールバック
   * フォーカス状態を更新
   * @param {Object} ctx - レンダリングコンテキスト
   */
  onGraphUpdated(ctx) {
    this.updateFocus(ctx);
  }

  /**
   * フォーカス更新ループをキャンセル
   * requestAnimationFrameで実行中のkeepFocusループを停止
   * @param {Object} ctx - レンダリングコンテキスト
   */
  cancelFocusUpdate(ctx) {
    if (ctx._focusFrame) {
      cancelAnimationFrame(ctx._focusFrame);
      ctx._focusFrame = null;
    }
  }

  /**
   * フォーカスノードへのカメラターゲット追従を更新
   * ユーザー操作中でなく、フォーカスノードがある場合、
   * requestAnimationFrameでカメラターゲットをノード位置に追従させる
   * @param {Object} ctx - レンダリングコンテキスト
   */
  updateFocus(ctx) {
    this.cancelFocusUpdate(ctx);
    if (!ctx.graph || ctx.ui.isUserInteracting) return;

    if (ctx.ui.focusedNode) {
      const keepFocus = () => {
        // ループ終了条件をチェック
        if (!ctx.ui.focusedNode || ctx.ui.isUserInteracting) {
          ctx._focusFrame = null;
          return;
        }

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