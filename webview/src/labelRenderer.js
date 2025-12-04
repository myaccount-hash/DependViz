// ラベル表示の基底クラス
class LabelRenderer {
  constructor(state) {
    this.state = state;
  }

  // サブクラスでオーバーライドするメソッド
  apply(graph, getNodeProps) {
    throw new Error('apply() must be implemented by subclass');
  }

  clear(graph) {
    throw new Error('clear() must be implemented by subclass');
  }

  getFontSize() {
    return this.state.controls.textSize || 12;
  }

  getLabel(node, props) {
    return props?.label || node.name || node.id;
  }
}

// 2D用のCanvasベースのラベルレンダラー
class Canvas2DLabelRenderer extends LabelRenderer {
  apply(graph, getNodeProps) {
    graph
      .nodeCanvasObject((node, ctx, globalScale) => {
        const props = getNodeProps(node);
        if (!props) return;
        const label = this.getLabel(node, props);
        const fontSize = this.getFontSize();
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = applyOpacityToColor('#ffffff', props.opacity);
        ctx.fillText(label, node.x, node.y);
      })
      .nodeCanvasObjectMode(() => 'after');
  }

  clear(graph) {
    graph.nodeCanvasObjectMode(() => null);
  }
}

// 3D用のCSS2DObjectベースのラベルレンダラー
class CSS3DLabelRenderer extends LabelRenderer {
  getFontSize() {
    return this.state.controls.nameFontSize || 12;
  }

  apply(graph, getNodeProps) {
    if (typeof window.CSS2DObject === 'undefined') {
      console.warn('[LabelRenderer] CSS2DObject not available');
      return;
    }

    graph.nodeThreeObject(node => {
      const props = getNodeProps(node);
      const div = document.createElement('div');
      div.textContent = this.getLabel(node, props);

      // 透明度を色とopacityの両方で反映
      const opacity = props.opacity !== undefined ? props.opacity : 1;

      Object.assign(div.style, {
        fontSize: `${this.getFontSize()}px`,
        fontFamily: 'sans-serif',
        padding: '2px 4px',
        borderRadius: '2px',
        pointerEvents: 'none',
        color: props.color,
        opacity: opacity.toString()
      });
      const label = new window.CSS2DObject(div);
      label.position.set(0, -8, 0);
      return label;
    }).nodeThreeObjectExtend(true);
  }

  clear(graph) {
    graph.nodeThreeObject(null).nodeThreeObjectExtend(false);
  }
}
