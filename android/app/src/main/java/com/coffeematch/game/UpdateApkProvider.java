package com.coffeematch.game;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/** Grants the system installer read access to only the verified APK. */
public final class UpdateApkProvider extends ContentProvider {
    static final String APK_TYPE = "application/vnd.android.package-archive";
    static final Uri APK_URI = Uri.parse("content://" + BuildConfig.APPLICATION_ID + ".update/CoffeeMatch.apk");

    static File apkFile(Context context) { return new File(context.getCacheDir(), "CoffeeMatch-update.apk"); }

    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { return APK_URI.equals(uri) ? APK_TYPE : null; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!APK_URI.equals(uri) || !"r".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(apkFile(getContext()), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        if (!APK_URI.equals(uri)) return null;
        String[] columns = projection == null
                ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        for (String column : columns) {
            if (OpenableColumns.DISPLAY_NAME.equals(column)) row.add("CoffeeMatch.apk");
            else if (OpenableColumns.SIZE.equals(column)) row.add(apkFile(getContext()).length());
            else row.add(null);
        }
        return cursor;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
