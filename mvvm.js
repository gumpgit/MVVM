// 基类

// 观察者 (发布订阅)
class Dep { 
  constructor() {
    this.subs = [];  // 存放所有的watcher
  }
  // 订阅
  addSub(watcher) { 
    this.subs.push(watcher);
  }

  // 发布
  notify() { 
    this.subs.forEach(watcher => watcher.update());
  }
}


class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    // 默认先存放一个老值
    this.oldValue = this.get();
  }
  get() {
    // 先把自己放再this上
    Dep.target = this;  
    // 取值 把这个观察者和数据关联起来
    let value = CompileUtil.getVal(this.vm, this.expr);
    Dep.target = null;
    return value;
  }
  update() { 
    // 跟新操作 数据变化后 会调用观察值的udpate 方法
    let newVal = CompileUtil.getVal(this.vm, this.expr);
    if (newVal !== this.oldValue) { 
      this.cb(newVal);
    }
  }
}

// 数据劫持
class Observer {
  constructor(data) {
    this.observer(data);    

  }
  observer(data) {
    if (data && typeof data == 'object') {
      for (let key in data) {
        this.defineReactive(data, key, data[key]);
      }
    }
  }

  defineReactive(obj, key, value) {
    this.observer(value); //深度 劫持
    let dep = new Dep() // 给每一个属性 都加上一具有发布订阅的功能

    Object.defineProperty(obj, key, {
      get() {
        // 创建watcher 时 会渠道对应的 内容, 并把watcher 放到全局上
        Dep.target && dep.addSub(Dep.target);
        return value;
      },
      set: (newVal) => {
        if (newVal != value) {
          this.observer(newVal); // 如果赋的值是 对象 也添加数据劫持
          value = newVal;
          dep.notify();
        };
      }
    })

  }
}


class Compiler {
  constructor(el, vm) {
    // 判度 el 属性 是是不是一个元素 如果不是元素 那就获取它
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    //console.log(this.vm, this.el);
    this.vm = vm;

    // 把当前节点元素获取放入内存中
    let fragment = this.node2fragment(this.el);
    // console.log(fragment);

    // 把节点中的内容进行替换

    // 编译模板 用数据编译
    this.compile(fragment);

    // 把内容再塞到内容内存中
    this.el.appendChild(fragment);
  }

  isDirective(attrName) {
    return attrName.startsWith('v-');
  }
  // 编译元素
  compileElement(node) {
    let attributes = node.attributes; // 类数组
    // console.log(attributes);
    [...attributes].forEach(attr => { //type="text" v-model="school.name"
      // console.log(attr)
      let {
        name,
        value: expr
      } = attr; // v-model="school.name"

      // 判断是不是指令 //v-
      if (this.isDirective(name)) { // v-model v-html v-bind
        // console.log(node, 'element');
        let [, directive] = name.split('-');
        // 需要调用不同的指令来处理     
        CompileUtil[directive](node, expr, this.vm);
      }
    })
  }

  // 编译文本
  compileText(node) {
    // 判断当前文本节点中内容是否包函 {{xxx}}
    let content = node.textContent;
    // console.log(content);
    if (/\{\{(.+?)\}\}/.test(content)) {
      console.log(content, 'text'); // 找到所有文本
      // 文本节点
      CompileUtil['text'](node, content, this.vm);

    }
  }

  // 编译内存中DOM
  // 核心编译方法
  compile(node) {
    let chaildNodes = node.childNodes;
    // console.log(chaildNodes);

    [...chaildNodes].forEach(child => {
      if (this.isElementNode(child)) {
        //console.log('element', child);

        this.compileElement(child);

        // 如果是元素的话 需要再便利子节点
        this.compile(child);
      } else {
        //console.log('text', child);
        this.compileText(child);
      }
    })
  }

  // 把节点移动到内存中
  node2fragment(node) {
    // 创建一个文档片段
    let fragment = document.createDocumentFragment();
    let firstChild;
    while (firstChild = node.firstChild) {
      // appendChild 具有移动新 页面DOM就不存在了
      fragment.appendChild(firstChild);
    }
    return fragment;
  }

  //是不是元素节点
  isElementNode(node) {
    return node.nodeType === 1;
  }
}

CompileUtil = {
  // 根据表达式获取对应的数据
  getVal(vm, expr) { // vm.$data  'school.name'
    return expr.split('.').reduce((data, current) => {
      return data[current];
    }, vm.$data)
  },
  model(node, expr, vm) { // node是节点 expr是表达式 vm是当前实例
    // 给输入框赋予value 属性 node.value = xxx
    let fn = this.updater['modelUpdater'];

    // 给输入框添加一个观察者, 如果数据更新会触发此方法,
    // 会拿到新值 给输入框赋值
    new Watcher(vm, expr, (newVal) => {
      fn(node, newVal);
    });

    let value = this.getVal(vm, expr);
    // console.log(value)
  },
  html() {
    // node.innerHTML = xxx
  },
  getContentValue(vm, expr) { 
    // 便利表达式 将内容 重新替换成一个完整的内容 返回
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(vm,args[1]);
    });
  },
  text(node, expr, vm) { // expr => {{a}} {{b}} {{c}}
    let fn = this.updater['textUpdater'];
    let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      // 给表达式 每个变量 加上观察者
      new Watcher(vm, args[1], (newVal) => {
        fn(node,this.getContentValue(vm,expr)); // 返回一个全的字符串
      });
      return this.getVal(vm, args[1]);
    });
    fn(node, content);
  },
  updater: {
    // 把数据插入到节点中
    modelUpdater(node, value) {
      node.value = value;
    },
    htmlUpdater() {

    },
    // 处理文本节点
    textUpdater(node, value) {
      node.textContent = value;
    }

  }

}

class Vue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;

    //根元素 存在 编译模板
    if (this.$el) {
      new Observer(this.$data);

      console.log(this.$data);

      new Compiler(this.$el, this);
    }
  }
}