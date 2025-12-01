package com.test;

public class UtilityClass {

    public static String utilityMethod(String input) {
        return "Utility: " + input;
    }

    public static int calculate(int a, int b) {
        return a + b;
    }

    private UtilityClass() {
        // ユーティリティクラスなのでコンストラクタはprivate
    }
}
