package com.test;

public class CallChainTest {

    public void methodA() {
        System.out.println("Method A");
        methodB();
    }

    public void methodB() {
        System.out.println("Method B");
        methodC();
    }

    public void methodC() {
        System.out.println("Method C");
        // 静的メソッドを呼び出し
        UtilityClass.utilityMethod("from C");
    }

    public static void staticMethodA() {
        System.out.println("Static Method A");
        staticMethodB();
    }

    public static void staticMethodB() {
        System.out.println("Static Method B");
        UtilityClass.calculate(1, 2);
    }

    public static void main(String[] args) {
        CallChainTest test = new CallChainTest();
        test.methodA();
        staticMethodA();
    }
}
