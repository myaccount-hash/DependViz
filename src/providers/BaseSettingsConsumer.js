class BaseSettingsConsumer {
    constructor() {
        this._controls = null;
    }

    handleSettingsChanged(controls) {
        this._controls = controls ? { ...controls } : null;
    }

    get controls() {
        return this._controls || {};
    }
}

module.exports = BaseSettingsConsumer;
