package com.test;

public class StaticMethodTest {

    public static String staticMethod(String input) {
        return "Static: " + input;
    }

    public String instanceMethod(String input) {
        return "Instance: " + input;
    }

    public void testStaticCall() {
        // 静的メソッド呼び出し（同じクラス内）
        String result1 = staticMethod("test1");

        // 静的メソッド呼び出し（クラス名経由）
        String result2 = StaticMethodTest.staticMethod("test2");

        // 別クラスの静的メソッド呼び出し
        String result3 = UtilityClass.utilityMethod("test3");

        // インスタンスメソッド呼び出し
        String result4 = instanceMethod("test4");

        // オブジェクト生成
        StaticMethodTest obj = new StaticMethodTest();
        String result5 = obj.instanceMethod("test5");
    }

    public static void main(String[] args) {
        // Java標準ライブラリの静的メソッド呼び出し
        System.out.println("Hello");
        String upper = String.valueOf(123);
        int max = Math.max(10, 20);

        StaticMethodTest test = new StaticMethodTest();
        test.testStaticCall();
    }
}
