import { DEFAULT_MODE, MODE_CONFIG } from './modeConfig.js';

export function createAppLayout() {
  const modeTabs = MODE_CONFIG.map((mode) => {
    const activeClass = mode.key === DEFAULT_MODE ? ' is-active' : '';
    return `<button id="${mode.tabButtonId}" class="mode-tab${activeClass}" type="button">${mode.tabLabel}</button>`;
  }).join('');

  const defaultTitle = MODE_CONFIG.find((mode) => mode.key === DEFAULT_MODE)?.panelTitle || '';

  return `
  <div class="app-shell">
    <nav class="mode-nav">
      ${modeTabs}
    </nav>

    <div class="top-layout">
      <aside class="panel panel-left">
      <h1 id="panelLeftTitle">${defaultTitle}</h1>

      <section class="group" data-mode-only="build">
        <h2>贴图输入</h2>
        <div class="folder-actions">
          <button id="pickTextureFolderBtn" type="button">选择贴图文件夹并自动映射</button>
          <button id="openRuleDialogBtn" type="button">匹配规则</button>
        </div>
        <input id="textureFolderInput" type="file" webkitdirectory directory multiple hidden />
        <label>基础图 / Albedo <input id="baseMap" type="file" accept="image/*" /></label>
        <label>Normal <input id="normalMap" type="file" accept="image/*" /></label>
        <label>Roughness <input id="roughnessMap" type="file" accept="image/*" /></label>
        <label>F0 <input id="f0Map" type="file" accept="image/*" /></label>
        <label>Alpha <input id="alphaMap" type="file" accept="image/*" /></label>
        <label>Depth <input id="depthMap" type="file" accept="image/*" /></label>
        <ul id="textureMappingList" class="mapping-list"></ul>
      </section>

      <section class="group" data-mode-only="build">
        <h2>材质和几何参数</h2>
        <label>细分段数
          <input id="segments" type="range" min="32" max="512" step="32" value="256" />
          <span id="segmentsValue">256</span>
        </label>
        <label>位移强度
          <input id="displacementScale" type="range" min="0" max="0.12" step="0.001" value="0.03" />
          <span id="displacementScaleValue">0.03</span>
        </label>
        <label>位移偏移
          <input id="displacementBias" type="range" min="-0.08" max="0.08" step="0.001" value="-0.015" />
          <span id="displacementBiasValue">-0.015</span>
        </label>
        <label>法线强度
          <input id="normalScale" type="range" min="0" max="3" step="0.01" value="1" />
          <span id="normalScaleValue">1.00</span>
        </label>
        <label>默认粗糙度
          <input id="roughnessValue" type="range" min="0" max="1" step="0.01" value="0.65" />
          <span id="roughnessValueText">0.65</span>
        </label>
        <label>默认金属度
          <input id="metalnessValue" type="range" min="0" max="1" step="0.01" value="0.03" />
          <span id="metalnessValueText">0.03</span>
        </label>
        <label>Triangulation 点数上限
          <input id="triangulationMaxPoints" type="range" min="20000" max="500000" step="10000" value="250000" />
          <span id="triangulationMaxPointsValue">250000</span>
        </label>
        <p id="triangulationEstimate" class="param-hint">预计网格：需先应用包含 Depth 的贴图</p>
      </section>

      <section class="group" data-mode-only="build">
        <h2>GLB 导出模式</h2>
        <label>导出类型
          <select id="exportMode">
            <option value="baked">立体 GLB（Depth 烘焙为真实几何）</option>
            <option value="flat">平面 GLB（保留材质位移贴图）</option>
          </select>
        </label>
      </section>

      <section class="group" data-mode-only="build">
        <button id="applyBtn">应用贴图并预览</button>
      </section>

      <section class="group" data-mode-only="build">
        <h2>导出</h2>
        <button id="exportBtn">导出 GLB</button>
      </section>

      <section class="group" data-mode-only="import">
        <h2>导入模式说明</h2>
        <p class="desc">当前模式用于加载已有 GLB/GLTF，并在右侧参数中实时调光和阴影。</p>
      </section>

      <section class="group" data-mode-only="import">
        <h2>导入模型到打光场景</h2>
        <label>GLB / GLTF
          <input id="importModel" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" />
        </label>
        <button id="importBtn">导入模型并打光</button>
      </section>

      <p id="status" class="status status-panel">等待上传贴图...</p>
      <section class="group step-group">
        <h2>步骤输出</h2>
        <ul id="stepLog" class="step-log"></ul>
      </section>
    </aside>

      <main class="viewer-wrap">
        <div id="viewer"></div>
      </main>

      <aside class="panel panel-right">
        <section class="group">
          <h2>主光源位置（XYZ）</h2>
          <label>Light X
            <input id="lightX" type="range" min="-5" max="5" step="0.01" value="1.5" />
            <span id="lightXValue">1.50</span>
          </label>
          <label>Light Y
            <input id="lightY" type="range" min="-5" max="5" step="0.01" value="1.2" />
            <span id="lightYValue">1.20</span>
          </label>
          <label>Light Z
            <input id="lightZ" type="range" min="-5" max="5" step="0.01" value="1.8" />
            <span id="lightZValue">1.80</span>
          </label>
          <label>光源强度
            <input id="lightIntensity" type="range" min="0" max="4" step="0.01" value="2.1" />
            <span id="lightIntensityValue">2.10</span>
          </label>
        </section>

        <section class="group">
          <h2>阴影参数</h2>
          <label>启用阴影
            <input id="enableShadows" type="checkbox" checked />
          </label>
          <label>模型 Cast Shadow
            <input id="modelCastShadow" type="checkbox" checked />
          </label>
          <label>模型 Receive Shadow
            <input id="modelReceiveShadow" type="checkbox" checked />
          </label>
          <label>Shadow Map
            <select id="shadowMapSize">
              <option value="1024">1024</option>
              <option value="2048" selected>2048</option>
              <option value="4096">4096</option>
            </select>
          </label>
          <label>Shadow Bias
            <input id="shadowBias" type="range" min="-0.005" max="0.005" step="0.0001" value="-0.0001" />
            <span id="shadowBiasValue">-0.0001</span>
          </label>
          <label>Shadow Normal Bias
            <input id="shadowNormalBias" type="range" min="0" max="0.15" step="0.001" value="0.02" />
            <span id="shadowNormalBiasValue">0.020</span>
          </label>
        </section>
      </aside>
    </div>

    <div id="ruleDialog" class="rule-dialog" hidden aria-hidden="true">
      <div class="rule-dialog-backdrop" id="ruleDialogBackdrop"></div>
      <div class="rule-dialog-panel" role="dialog" aria-labelledby="ruleDialogTitle">
        <h2 id="ruleDialogTitle">文件夹命名匹配规则</h2>
        <p class="rule-dialog-desc">多个前缀用英文逗号分隔，匹配时忽略大小写。</p>
        <label>BaseColor / Albedo
          <input id="ruleBaseMap" type="text" value="BaseColor_,Albedo_,Base_Color_,Diffuse_" />
        </label>
        <label>Normal
          <input id="ruleNormalMap" type="text" value="Normal_" />
        </label>
        <label>Roughness
          <input id="ruleRoughnessMap" type="text" value="Roughness_" />
        </label>
        <label>F0
          <input id="ruleF0Map" type="text" value="F0_,Specular_,Metallic_" />
        </label>
        <label>Alpha
          <input id="ruleAlphaMap" type="text" value="Alpha_,Opacity_" />
        </label>
        <label>Depth
          <input id="ruleDepthMap" type="text" value="Depth_,Displacement_" />
        </label>
        <div class="rule-dialog-actions">
          <button id="ruleDialogCloseBtn" type="button">关闭</button>
        </div>
      </div>
    </div>
  </div>
`;
}
